import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { ResourceLimitService } from '../common/services/resource-limit.service';
import { QueueService } from '../queue/queue.service';
import {
  CreateMemberDto,
  UpdateMemberDto,
  FreezeMemberDto,
  RenewMemberDto,
} from './dto';
import { randomUUID, randomBytes } from 'crypto';
import {
  assertMemberTransition,
  assertMembershipTransition,
} from '../common/status-transitions';
import {
  renderInvoiceHtml,
  DEFAULT_TEMPLATE_ID,
} from '../invoices/invoice-templates';
import { EventStoreService } from '../events/event-store.service';
import { EventProjectorService } from '../events/event-projector.service';
import { MemberDirectoryService } from '../member/directory/member-directory.service';
import { getTenantGymId } from '../common/tenant-context';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
} from '../common/defaults';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    // `prisma` (legacy) retained ONLY for saveFaceDescriptor's raw studio_template
    // face_vec write — a Phase 7 (raw-SQL schema-dynamic) site. Everything else:
    // registry → pub, tenant → tenant.client.
    private prisma: PrismaService,
    private pub: PublicPrismaService,
    private tenant: TenantPrisma,
    private resourceLimits: ResourceLimitService,
    private queueService: QueueService,
    private eventStore: EventStoreService,
    private eventProjector: EventProjectorService,
    private memberDirectory: MemberDirectoryService,
  ) {}

  private generateMemberCode(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(4).toString('hex').toUpperCase();
    return `FS-${date}-${rand}`;
  }

  private stripSensitive(member: any) {
    const { face_descriptor, ...safe } = member;
    // Prisma Decimal serializes as a Decimal.js object over JSON, which the
    // frontend reads as `[object Object]` / NaN. Coerce every numeric column
    // we expose to a plain number before it leaves the API.
    const toNumber = (v: any) =>
      v === null || v === undefined ? v : Number(v.toString());
    if (Array.isArray(safe.memberships)) {
      safe.memberships = safe.memberships.map((m: any) => {
        if (m?.plan) {
          m.plan.price = toNumber(m.plan.price);
          if ('yearly_price' in m.plan)
            m.plan.yearly_price = toNumber(m.plan.yearly_price);
        }
        return m;
      });
    }
    if (Array.isArray(safe.payments)) {
      safe.payments = safe.payments.map((p: any) => {
        if (p && 'amount' in p) p.amount = toNumber(p.amount);
        return p;
      });
    }
    // The fitness profile carries Decimal columns (height/weight/body fat) which
    // otherwise serialize as `[object Object]` for the admin UI — coerce them.
    if (safe.profile) {
      safe.profile.height = toNumber(safe.profile.height);
      safe.profile.weight = toNumber(safe.profile.weight);
      safe.profile.body_fat_percentage = toNumber(safe.profile.body_fat_percentage);
    }
    return safe;
  }

  // ── List Members ──────────────────────────────────────────────

  async findAll(
    studioId: string,
    query: {
      status?: string;
      branch_id?: string;
      organization_id?: string;
      search?: string;
      tag_id?: string;
      plan_id?: string;
      trainer_id?: string;
      churn_risk?: string;
      page?: number;
      limit?: number;
      user_branch_ids?: string[];
    },
  ) {
    const {
      status,
      branch_id,
      organization_id,
      search,
      tag_id,
      plan_id,
      trainer_id,
      churn_risk,
      page = 1,
      limit = 50,
      user_branch_ids,
    } = query;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;

    const where: any = {};
    if (status) where.status = status;
    if (organization_id) where.organization_id = organization_id;
    if (churn_risk) where.churn_risk = churn_risk;

    if (branch_id) {
      // Explicit branch filter: still clamp to user's assigned branches if restricted.
      if (user_branch_ids && !user_branch_ids.includes(branch_id)) {
        return { data: [], total: 0, page, limit };
      }
      where.branch_id = branch_id;
    } else if (Array.isArray(user_branch_ids)) {
      // Non-owner caller: restrict to assigned branches. Empty set → no results.
      if (user_branch_ids.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      where.branch_id = { in: user_branch_ids };
    }

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { member_code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tag_id) {
      where.tag_assignments = { some: { tag_id } };
    }

    if (plan_id) {
      where.memberships = { some: { plan_id, status: 'active' } };
    }

    if (trainer_id) {
      where.trainer_clients = { some: { trainer_id, status: 'active' } };
    }

    const [rawData, total] = await Promise.all([
      this.tenant.client.member.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
          memberships: {
            where: { status: 'active' },
            include: { plan: true },
            take: 1,
            orderBy: { created_at: 'desc' },
          },
          tag_assignments: { include: { tag: true } },
          _count: { select: { check_ins: true, payments: true } },
        },
        skip,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
      }),
      this.tenant.client.member.count({ where }),
    ]);

    const data = rawData.map((m) => this.stripSensitive(m));
    return { data, total, page, limit };
  }

  // ── 360° Member View ──────────────────────────────────────────

  async findOne(studioId: string, id: string) {
    const member = await this.tenant.client.member.findFirst({
      where: { id },
      include: {
        branch: true,
        organization: { select: { id: true, name: true } },
        profile: true,
        memberships: {
          include: { plan: true },
          orderBy: { created_at: 'desc' },
        },
        payments: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        check_ins: {
          orderBy: { checked_in_at: 'desc' },
          take: 20,
        },
        tag_assignments: { include: { tag: true } },
        trainer_clients: {
          where: { status: 'active' },
          include: {
            trainer: { select: { id: true, full_name: true, role: true } },
          },
        },
        class_enrollments: {
          orderBy: { enrolled_at: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            check_ins: true,
            payments: true,
            body_stats: true,
            member_notes: true,
            documents: true,
          },
        },
      },
    });

    if (!member) throw new NotFoundException('Member not found');
    return this.stripSensitive(member);
  }

  // ── Check Phone Duplicate ─────────────────────────────────────

  async checkPhone(phone: string, organizationId?: string) {
    if (!phone) return { exists: false };
    const member = await this.tenant.client.member.findFirst({
      where: {
        ...(organizationId ? { organization_id: organizationId } : {}),
        phone,
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        full_name: true,
        member_code: true,
        branch: { select: { name: true } },
      },
    });
    if (!member) return { exists: false };
    return {
      exists: true,
      member_id: member.id,
      full_name: member.full_name,
      member_code: member.member_code,
      branch_name: member.branch?.name,
    };
  }

  // ── Create Member ─────────────────────────────────────────────

  async create(studioId: string, dto: CreateMemberDto) {
    try {
      return await this.createInner(studioId, dto);
    } catch (err: any) {
      // Pass through well-formed HTTP exceptions — they carry their own status
      const isHttp = err && typeof err.getStatus === 'function';
      if (isHttp) throw err;
      this.logger.error(
        `Member create failed for studio=${studioId}: ${err?.message}` +
          (err?.code ? ` [code=${err.code}]` : ''),
        err?.stack,
      );
      if (err?.meta)
        this.logger.error(`Prisma meta: ${JSON.stringify(err.meta)}`);
      throw new BadRequestException(
        err?.meta?.cause || err?.message || 'Failed to create member',
      );
    }
  }

  private async createInner(studioId: string, dto: CreateMemberDto) {
    // Enforce plan-based member limit before creation
    await this.resourceLimits.checkMemberLimit(studioId, dto.organization_id);

    // Enforce: at least one active membership plan must exist before creating a member
    const activePlanCount = await this.tenant.client.membershipPlan.count({
      where: { is_active: true },
    });
    if (activePlanCount === 0) {
      throw new BadRequestException(
        'Create at least one membership plan before adding members',
      );
    }

    // Resolve organization_id — if not provided, find or auto-create from studio data
    let organizationId = dto.organization_id;
    if (!organizationId) {
      const org = await this.tenant.client.organization.findFirst({
        select: { id: true },
      });
      organizationId = org?.id;
    }
    if (!organizationId) {
      // Auto-create organization from studio data (happens when onboarding org creation silently failed)
      try {
        const studio = await this.pub.studio.findUnique({
          where: { id: studioId },
          select: {
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            country: true,
          },
        });
        if (studio) {
          const newOrg = await this.tenant.client.organization.create({
            data: {
              gym_id: getTenantGymId()!,
              name: studio.name,
              slug: studio.slug,
              country: studio.country ?? undefined,
              timezone: studio.timezone || DEFAULT_TIMEZONE,
              currency: studio.currency || DEFAULT_CURRENCY,
              status: 'active',
            },
          });
          organizationId = newOrg.id;
          this.logger.log(`Auto-created organization for studio ${studioId}`);
        }
      } catch (e) {
        this.logger.error(`Failed to auto-create organization: ${e}`);
      }
    }
    if (!organizationId) {
      throw new BadRequestException(
        'Studio setup incomplete. Please contact support.',
      );
    }

    // Pre-flight: verify branch_id belongs to this studio so we return a clean 400
    // instead of a Prisma FK violation if the client sends a stale/wrong branch.
    const branch = await this.tenant.client.branch.findFirst({
      where: { id: dto.branch_id },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException(
        `Invalid branch_id: ${dto.branch_id} does not belong to this studio`,
      );
    }

    // Check for duplicate phone in this studio
    const existingMember = await this.tenant.client.member.findFirst({
      where: {
        organization_id: organizationId,
        phone: dto.phone,
        status: { not: 'cancelled' },
      },
      select: { id: true, full_name: true, member_code: true },
    });
    if (existingMember) {
      throw new ConflictException(
        JSON.stringify({
          code: 'PHONE_DUPLICATE',
          message: `Phone number is already registered to ${existingMember.full_name} (${existingMember.member_code})`,
          existing_member_id: existingMember.id,
          existing_member_name: existingMember.full_name,
          existing_member_code: existingMember.member_code,
        }),
      );
    }

    // Check for duplicate email in this studio (DB has unique (gym_id, email))
    if (dto.email) {
      const existingByEmail = await this.tenant.client.member.findFirst({
        where: { email: dto.email },
        select: { id: true, full_name: true, member_code: true },
      });
      if (existingByEmail) {
        throw new ConflictException(
          JSON.stringify({
            code: 'EMAIL_DUPLICATE',
            message: `Email is already registered to ${existingByEmail.full_name} (${existingByEmail.member_code})`,
            existing_member_id: existingByEmail.id,
            existing_member_name: existingByEmail.full_name,
            existing_member_code: existingByEmail.member_code,
          }),
        );
      }
    }

    const memberCode = this.generateMemberCode();
    const qrCode = randomUUID();

    // ── TRANSACTION: Create member + emit MEMBER_CREATED event atomically ──
    // The event is the source of truth. If the event can't be written, the member creation rolls back.
    let { member, membership, payment, event, paymentEvent } =
      await this.tenant.client.$transaction(async (tx) => {
        const newMember = await tx.member.create({
          data: {
            gym_id: getTenantGymId()!,
            member_code: memberCode,
            organization_id: organizationId,
            branch_id: dto.branch_id,
            full_name: dto.full_name,
            phone: dto.phone,
            email: dto.email,
            gender: dto.gender,
            date_of_birth: dto.date_of_birth
              ? new Date(dto.date_of_birth)
              : null,
            join_date: dto.join_date ? new Date(dto.join_date) : new Date(),
            emergency_contact_name: dto.emergency_contact_name,
            emergency_contact_phone: dto.emergency_contact_phone,
            profile_photo_url: dto.profile_photo_url,
            checkin_method: dto.checkin_method || 'manual',
            qr_code: qrCode,
            notes: dto.notes,
            referred_by_member_id: dto.referred_by_member_id,
            referral_code: randomUUID().slice(0, 8).toUpperCase(),
            status: dto.status || 'active',
          },
          include: { branch: true },
        });

        let newMembership = null;
        let newPayment = null;
        let newPaymentEvent = null;
        if (dto.plan_id) {
          const plan = await tx.membershipPlan.findUnique({
            where: { id: dto.plan_id },
          });
          if (!plan) throw new BadRequestException('Invalid plan');

          const startDate = dto.membership_start_date
            ? new Date(dto.membership_start_date)
            : new Date();
          const endDate = plan.duration_days
            ? new Date(startDate.getTime() + plan.duration_days * 86400000)
            : null;

          newMembership = await tx.memberMembership.create({
            data: {
              gym_id: getTenantGymId()!,
              member_id: newMember.id,
              plan_id: dto.plan_id,
              branch_id: dto.branch_id,
              start_date: startDate,
              end_date: endDate,
              classes_remaining: plan.total_classes,
              status: 'active',
            },
            include: { plan: true },
          });

          // Record initial membership payment so revenue/dashboards reflect the sale.
          const paymentAmount = dto.payment_amount ?? Number(plan.price);
          if (paymentAmount > 0) {
            const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
            newPayment = await tx.payment.create({
              data: {
                gym_id: getTenantGymId()!,
                member_id: newMember.id,
                membership_id: newMembership.id,
                branch_id: dto.branch_id,
                amount: paymentAmount,
                payment_method: dto.payment_method || 'cash',
                status: 'paid',
                receipt_number: receiptNumber,
                paid_at: new Date(),
              },
            });

            newPaymentEvent = await this.eventStore.emit(tx, {
              aggregate_type: 'payment',
              aggregate_id: newPayment.id,
              event_type: 'PAYMENT_RECORDED',
              payload: {
                payment_id: newPayment.id,
                member_id: newMember.id,
                membership_id: newMembership.id,
                amount: paymentAmount,
                payment_method: newPayment.payment_method,
                receipt_number: receiptNumber,
              },
              branch_id: dto.branch_id,
            });
          }
        }

        // Emit MEMBER_CREATED event — MUST succeed or entire tx rolls back
        const evt = await this.eventStore.emit(tx, {
          aggregate_type: 'member',
          aggregate_id: newMember.id,
          event_type: 'MEMBER_CREATED',
          payload: {
            member_id: newMember.id,
            member_code: newMember.member_code,
            full_name: newMember.full_name,
            status: newMember.status,
            branch_id: dto.branch_id,
            plan_id: dto.plan_id || null,
          },
          branch_id: dto.branch_id,
        });

        return {
          member: newMember,
          membership: newMembership,
          payment: newPayment,
          event: evt,
          paymentEvent: newPaymentEvent,
        };
      });

    // ── Post-commit: Project the event into dashboard metrics ──
    // This runs outside the transaction. If it fails, the event is in the store
    // and will be picked up by the catchup projector — NO silent swallowing.
    this.eventProjector
      .processEvent({
        id: event.id,
        gym_id: getTenantGymId()!,
        event_type: 'MEMBER_CREATED',
        payload: {
          full_name: member.full_name,
          member_code: member.member_code,
          status: member.status,
        },
        branch_id: dto.branch_id,
        version: event.version,
      })
      .catch((err) => {
        // Projection failure is logged as ERROR, not warn — catchup will fix it
        this.logger.error(
          `Projection failed for MEMBER_CREATED (event=${event.id}): ${(err as Error).message}`,
        );
      });

    // ── Post-commit: maintain the member-app directory (phone → gym lookup) ──
    // Fire-and-forget like the projection above; backfill() is the safety net
    // if this misses. The member app's auth path reads this table.
    this.memberDirectory
      .syncMember({
        memberId: member.id,
        tenantId: getTenantGymId()!,
        phone: member.phone,
        status: member.status,
      })
      .catch((err) => {
        this.logger.error(
          `member_directory sync failed for member ${member.id}: ${(err as Error).message}`,
        );
      });

    if (payment && paymentEvent) {
      this.eventProjector
        .processEvent({
          id: paymentEvent.id,
          gym_id: getTenantGymId()!,
          event_type: 'PAYMENT_RECORDED',
          payload: {
            amount: Number(payment.amount),
            payment_method: payment.payment_method,
          },
          branch_id: dto.branch_id,
          version: paymentEvent.version,
        })
        .catch((err) => {
          this.logger.error(
            `Projection failed for PAYMENT_RECORDED (event=${paymentEvent.id}): ${(err as Error).message}`,
          );
        });
    }

    // Apply referral free days (from Studio settings) if member was referred
    if (dto.referred_by_member_id && membership) {
      try {
        // Read referral settings from Studio table (public schema).
        // MUST filter by the current studio id from trusted tenant context —
        // a bare LIMIT 1 returns an arbitrary gym's settings (cross-tenant bleed).
        const currentStudioId = getTenantGymId();
        const studioRow = currentStudioId
          ? await this.pub.studio
              .findUnique({
                where: { id: currentStudioId },
                select: { referral_free_days: true, referral_reward_days: true },
              })
              .catch(() => null)
          : null;

        const freeDays: number = Number(studioRow?.referral_free_days ?? 0);
        const rewardDays: number = Number(studioRow?.referral_reward_days ?? 0);

        // Extend referred member's membership end_date
        if (freeDays > 0 && membership.end_date) {
          const newEnd = new Date(membership.end_date);
          newEnd.setDate(newEnd.getDate() + freeDays);
          membership = await this.tenant.client.memberMembership.update({
            where: { id: membership.id },
            data: { end_date: newEnd },
            include: { plan: true },
          });
        }

        // Extend referrer's active membership as reward
        if (rewardDays > 0) {
          const referrerMembership =
            await this.tenant.client.memberMembership.findFirst({
              where: { member_id: dto.referred_by_member_id, status: 'active' },
              orderBy: { created_at: 'desc' },
            });
          if (referrerMembership?.end_date) {
            const newReferrerEnd = new Date(referrerMembership.end_date);
            newReferrerEnd.setDate(newReferrerEnd.getDate() + rewardDays);
            await this.tenant.client.memberMembership.update({
              where: { id: referrerMembership.id },
              data: { end_date: newReferrerEnd },
            });
          }
        }
      } catch (err) {
        this.logger.warn(
          `Failed to apply referral free days: ${(err as Error).message}`,
        );
      }
    }

    // Send welcome email with invoice if member has email and a plan
    if (member.email && membership) {
      this.sendMemberInvoiceEmail(member, membership).catch((err) => {
        this.logger.warn(
          `Failed to queue invoice email for ${member.member_code}: ${err.message}`,
        );
      });
    }

    return { ...member, membership };
  }

  private async sendMemberInvoiceEmail(
    member: {
      id: string;
      full_name: string;
      email: string | null;
      phone: string;
      member_code: string;
      branch?: { name: string } | null;
    },
    membership: {
      plan: { name: string; price: any; currency?: string };
      start_date: Date;
      end_date: Date | null;
    },
  ) {
    if (!member.email) return;

    const now = new Date();
    const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

    // Fetch studio info from public schema for invoice header
    let gymName = 'Gym';
    let gymLogo: string | undefined;
    let gymAddress: string | undefined;
    let gymPhone: string | undefined;
    let gymEmail: string | undefined;
    try {
      const org = await this.tenant.client.organization.findFirst({
        select: { name: true },
      });
      if (org) gymName = org.name;
    } catch {
      /* ignore */
    }

    const invoiceHtml = renderInvoiceHtml(DEFAULT_TEMPLATE_ID, {
      gym_name: gymName,
      gym_logo_url: gymLogo,
      gym_address: gymAddress,
      gym_phone: gymPhone,
      gym_email: gymEmail,
      member_name: member.full_name,
      member_code: member.member_code,
      member_email: member.email,
      member_phone: member.phone,
      plan_name: membership.plan.name,
      plan_price: Number(membership.plan.price).toFixed(2),
      currency: membership.plan.currency ?? DEFAULT_CURRENCY,
      start_date: membership.start_date.toLocaleDateString(DEFAULT_LOCALE),
      end_date: membership.end_date?.toLocaleDateString(DEFAULT_LOCALE),
      invoice_number: invoiceNumber,
      invoice_date: now.toLocaleDateString(DEFAULT_LOCALE),
      payment_status: 'Paid',
    });

    await this.queueService.enqueueEmail({
      to: member.email,
      subject: `Welcome to ${gymName} — Your Membership Invoice #${invoiceNumber}`,
      template: invoiceHtml,
      variables: {}, // Already rendered
    });

    this.logger.log(
      `Invoice email queued for ${member.member_code} → ${member.email}`,
    );
  }

  // ── Update Member ─────────────────────────────────────────────

  async update(studioId: string, id: string, dto: UpdateMemberDto) {
    await this.findOne(studioId, id);

    // Guard: prevent manually setting status='active' without an active membership
    if (dto.status === 'active') {
      const activeMembership = await this.tenant.client.memberMembership.findFirst({
        where: { member_id: id, status: 'active' },
      });
      if (!activeMembership) {
        throw new BadRequestException(
          'Cannot activate member without an active membership. Record a payment first.',
        );
      }
    }

    const updated = await this.tenant.client.member.update({
      where: { id },
      data: {
        ...dto,
        date_of_birth: dto.date_of_birth
          ? new Date(dto.date_of_birth)
          : undefined,
        join_date: dto.join_date ? new Date(dto.join_date) : undefined,
      },
      include: { branch: true },
    });
    return this.stripSensitive(updated);
  }

  // ── Soft Delete ───────────────────────────────────────────────

  async softDelete(studioId: string, id: string) {
    const member = await this.tenant.client.member.findFirst({
      where: { id },
    });
    if (!member) throw new NotFoundException('Member not found');
    assertMemberTransition(member.status, 'cancelled');

    const { result, event } = await this.tenant.client.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id },
        data: { status: 'cancelled' },
        select: { id: true, status: true, branch_id: true },
      });

      const evt = await this.eventStore.emit(tx, {
        aggregate_type: 'member',
        aggregate_id: id,
        event_type: 'MEMBER_CANCELLED',
        payload: { member_id: id, was_active: member.status === 'active' },
        branch_id: (updated as any).branch_id,
      });

      return { result: updated, event: evt };
    });

    this.eventProjector
      .processEvent({
        id: event.id,
        gym_id: getTenantGymId()!,
        event_type: 'MEMBER_CANCELLED',
        payload: { was_active: member.status === 'active' },
        branch_id: (result as any).branch_id,
        version: event.version,
      })
      .catch((err) => {
        this.logger.error(
          `Projection failed for MEMBER_CANCELLED (event=${event.id}): ${(err as Error).message}`,
        );
      });

    return result;
  }

  // ── Freeze / Unfreeze ─────────────────────────────────────────

  async freeze(studioId: string, id: string, dto: FreezeMemberDto) {
    const member = await this.tenant.client.member.findFirst({
      where: { id },
      include: { memberships: { where: { status: 'active' }, take: 1 } },
    });
    if (!member) throw new NotFoundException('Member not found');
    assertMemberTransition(member.status, 'frozen');

    const activeMembership = member.memberships[0];
    if (!activeMembership)
      throw new BadRequestException('No active membership to freeze');
    assertMembershipTransition(activeMembership.status, 'frozen');

    const updated = await this.tenant.client.memberMembership.update({
      where: { id: activeMembership.id },
      data: {
        status: 'frozen',
        freeze_start_date: new Date(dto.freeze_start_date),
        freeze_end_date: new Date(dto.freeze_end_date),
        freeze_reason: dto.reason,
      },
      include: { plan: true },
    });

    await this.tenant.client.member.update({
      where: { id },
      data: { status: 'frozen' },
    });

    return updated;
  }

  async unfreeze(studioId: string, id: string) {
    const member = await this.tenant.client.member.findFirst({
      where: { id },
      include: { memberships: { where: { status: 'frozen' }, take: 1 } },
    });
    if (!member) throw new NotFoundException('Member not found');
    assertMemberTransition(member.status, 'active');

    const frozenMembership = member.memberships[0];
    if (!frozenMembership)
      throw new BadRequestException('No frozen membership found');
    assertMembershipTransition(frozenMembership.status, 'active');

    // Calculate days frozen and extend end_date accordingly
    const freezeStart = frozenMembership.freeze_start_date;
    const now = new Date();
    const frozenDays = freezeStart
      ? Math.ceil((now.getTime() - freezeStart.getTime()) / 86400000)
      : 0;

    const newEndDate =
      frozenMembership.end_date && frozenDays > 0
        ? new Date(frozenMembership.end_date.getTime() + frozenDays * 86400000)
        : frozenMembership.end_date;

    const updated = await this.tenant.client.memberMembership.update({
      where: { id: frozenMembership.id },
      data: {
        status: 'active',
        end_date: newEndDate,
        freeze_start_date: null,
        freeze_end_date: null,
        freeze_reason: null,
      },
      include: { plan: true },
    });

    await this.tenant.client.member.update({
      where: { id },
      data: { status: 'active' },
    });

    return { ...updated, frozen_days_added: frozenDays };
  }

  // ── Renew Membership ──────────────────────────────────────────

  async renew(studioId: string, id: string, dto: RenewMemberDto) {
    const plan = await this.tenant.client.membershipPlan.findUnique({
      where: { id: dto.plan_id },
    });
    if (!plan) throw new BadRequestException('Invalid plan');

    const member = await this.tenant.client.member.findFirst({
      where: { id },
    });
    if (!member) throw new NotFoundException('Member not found');

    const startDate = new Date();
    const endDate = plan.duration_days
      ? new Date(startDate.getTime() + plan.duration_days * 86400000)
      : null;

    const membership = await this.tenant.client.memberMembership.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: id,
        plan_id: dto.plan_id,
        branch_id: member.branch_id,
        start_date: startDate,
        end_date: endDate,
        classes_remaining: plan.total_classes,
        status: 'active',
      },
      include: { plan: true },
    });

    const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const payment = await this.tenant.client.payment.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: id,
        membership_id: membership.id,
        branch_id: member.branch_id,
        amount: plan.price,
        payment_method: dto.payment_method,
        status: 'paid',
        receipt_number: receiptNumber,
        paid_at: new Date(),
      },
    });

    await this.tenant.client.member.update({
      where: { id },
      data: { status: 'active' },
    });

    return { membership, payment };
  }

  // ── Face Descriptor ───────────────────────────────────────────

  async saveFaceDescriptor(studioId: string, id: string, descriptor: number[]) {
    await this.findOne(studioId, id);
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      throw new Error('Face descriptor must be a 128-element array');
    }

    // Dual-write: face_descriptor (legacy Float[]) + face_vec (pgvector).
    // The pgvector column powers the IVFFlat-indexed matcher; the legacy
    // column is preserved until rollout is verified, then dropped in a
    // future cleanup migration.
    const vecLiteral = `[${descriptor.map((n) => (Number.isFinite(n) ? n : 0)).join(',')}]`;

    // PHASE 7: this raw face_vec write hardcodes `studio_template.members` and is
    // part of the face-matching subsystem (facial-matcher / face-api-pgvector),
    // which is migrated to schema-dynamic raw SQL as a unit in Phase 7. Until then
    // the whole tx stays on the legacy client (writes land in studio_template).
    await this.prisma.$transaction([
      this.prisma.member.update({
        where: { id },
        data: { face_descriptor: descriptor },
      }),
      this.prisma.$executeRaw`
        UPDATE studio_template.members SET face_vec = ${vecLiteral}::vector
        WHERE id = ${id}::uuid AND gym_id = ${studioId}::uuid
      `,
    ]);

    return { success: true };
  }

  // ── Churn Risk ────────────────────────────────────────────────

  async getChurnRisk(studioId: string, risk?: string) {
    const where: any = {};
    if (risk) where.churn_risk = risk;

    return this.tenant.client.member.findMany({
      where,
      select: {
        id: true,
        member_code: true,
        full_name: true,
        phone: true,
        email: true,
        status: true,
        engagement_score: true,
        churn_risk: true,
        last_visit_at: true,
        branch: { select: { id: true, name: true } },
        memberships: {
          where: { status: 'active' },
          include: { plan: true },
          take: 1,
        },
      },
      orderBy: { engagement_score: 'asc' },
    });
  }

  // ── Visit Statistics ──────────────────────────────────────────

  async getVisitStats(studioId: string, memberId: string) {
    const member = await this.tenant.client.member.findFirst({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    const [total, last30, last90, lastVisit] = await Promise.all([
      this.tenant.client.checkIn.count({ where: { member_id: memberId } }),
      this.tenant.client.checkIn.count({
        where: { member_id: memberId, checked_in_at: { gte: thirtyDaysAgo } },
      }),
      this.tenant.client.checkIn.count({
        where: { member_id: memberId, checked_in_at: { gte: ninetyDaysAgo } },
      }),
      this.tenant.client.checkIn.findFirst({
        where: { member_id: memberId },
        orderBy: { checked_in_at: 'desc' },
        select: {
          checked_in_at: true,
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      total_visits: total,
      visits_last_30_days: last30,
      visits_last_90_days: last90,
      avg_visits_per_week:
        last30 > 0 ? Math.round((last30 / 4.3) * 10) / 10 : 0,
      last_visit: lastVisit,
    };
  }

  // ── Member Lifecycle Summary ──────────────────────────────────

  async getLifecycleSummary(
    studioId: string,
    filters?: { branch_id?: string; organization_id?: string },
  ) {
    const where: any = {};
    if (filters?.branch_id) where.branch_id = filters.branch_id;
    if (filters?.organization_id)
      where.organization_id = filters.organization_id;

    const statuses = [
      'lead',
      'trial',
      'active',
      'inactive',
      'cancelled',
      'frozen',
      'expiring_soon',
      'expired',
    ];
    const counts = await Promise.all(
      statuses.map((s) =>
        this.tenant.client.member.count({ where: { ...where, status: s } }),
      ),
    );

    const total = await this.tenant.client.member.count({ where });
    const summary: Record<string, number> = {};
    statuses.forEach((s, i) => {
      summary[s] = counts[i];
    });

    return { total, by_status: summary };
  }
}
