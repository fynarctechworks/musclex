import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  Prisma,
  TenantStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import {
  CreateTenantDto,
  UpdateTenantDto,
  ChangeTenantPlanDto,
  TenantFilterDto,
} from './dto/tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
  ) {}

  async findAll(filters: TenantFilterDto) {
    const where: Prisma.TenantWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.plan_id) where.plan_id = filters.plan_id;
    if (filters.is_active !== undefined) where.is_active = filters.is_active;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { owner_email: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Whitelist allowed sort fields to prevent SQL injection via dynamic field names
    const ALLOWED_SORT_FIELDS = ['created_at', 'name', 'status', 'owner_email', 'updated_at'];
    const sortField = ALLOWED_SORT_FIELDS.includes(filters.sort_by ?? '')
      ? filters.sort_by
      : 'created_at';
    const orderBy: Prisma.TenantOrderByWithRelationInput = {
      [sortField!]: filters.sort_order || 'desc',
    };

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          plan: { select: { id: true, name: true, price_monthly: true } },
          _count: { select: { subscriptions: true, payments: true } },
        },
        orderBy,
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return new PaginatedResult(data, total, filters.page!, filters.limit!);
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        subscriptions: { orderBy: { created_at: 'desc' }, take: 5 },
        payments: { orderBy: { created_at: 'desc' }, take: 10 },
        feature_flags: { include: { flag: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  /** Call-center search: find tenant by ID (UUID) or slug */
  async findByIdOrSlug(query: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const where = uuidRegex.test(query) ? { id: query } : { slug: query };

    const tenant = await this.prisma.tenant.findUnique({
      where,
      include: {
        plan: true,
        subscriptions: { orderBy: { created_at: 'desc' }, take: 3 },
        payments: { orderBy: { created_at: 'desc' }, take: 5 },
      },
    });
    if (!tenant) throw new NotFoundException(`No gym found for "${query}"`);
    return tenant;
  }

  async create(dto: CreateTenantDto, ctx: AuditContext) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already taken');

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day trial

    // If a plan is assigned, validate it and stamp its limits onto the tenant so
    // the tenant's effective limits stay in sync with the plan from day one.
    let planLimits: Partial<Pick<Prisma.TenantCreateInput, 'max_members' | 'max_branches' | 'max_staff'>> = {};
    if (dto.plan_id) {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: dto.plan_id },
      });
      if (!plan || !plan.is_active) {
        throw new BadRequestException('Invalid or inactive plan');
      }
      const l = (plan.limits as Record<string, number> | null) ?? {};
      if (l.max_members != null) planLimits.max_members = l.max_members;
      if (l.max_branches != null) planLimits.max_branches = l.max_branches;
      if (l.max_staff != null) planLimits.max_staff = l.max_staff;
    }

    // Create the tenant and (if a plan is assigned) its trial subscription
    // atomically — never leave a tenant without the subscription it should have.
    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          ...dto,
          ...planLimits,
          trial_ends_at: trialEndsAt,
        },
        include: { plan: true },
      });

      if (dto.plan_id) {
        await tx.subscription.create({
          data: {
            tenant_id: created.id,
            plan_id: dto.plan_id,
            status: 'TRIALING',
            start_date: new Date(),
            end_date: trialEndsAt,
          },
        });
      }

      return created;
    });

    await this.audit.log(AuditAction.CREATE, 'tenant', tenant.id, ctx, {
      new_value: { name: tenant.name, slug: tenant.slug },
    });

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, ctx: AuditContext) {
    const tenant = await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: dto,
      include: { plan: true },
    });

    await this.audit.log(AuditAction.UPDATE, 'tenant', id, ctx, {
      old_value: dto, // simplified diff
      new_value: updated,
    });

    return updated;
  }

  async changePlan(id: string, dto: ChangeTenantPlanDto, ctx: AuditContext) {
    const tenant = await this.findOne(id);

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.plan_id },
    });
    if (!plan || !plan.is_active) {
      throw new BadRequestException('Invalid or inactive plan');
    }

    const oldPlanId = tenant.plan_id;

    // Update tenant plan + cancel old subs + create new subscription in a transaction
    const [updatedTenant, _cancelledSubs, subscription] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id },
        data: {
          plan_id: dto.plan_id,
          status: TenantStatus.ACTIVE,
          max_members: (plan.limits as any)?.max_members ?? tenant.max_members,
          max_branches: (plan.limits as any)?.max_branches ?? tenant.max_branches,
          max_staff: (plan.limits as any)?.max_staff ?? tenant.max_staff,
        },
      }),
      this.prisma.subscription.updateMany({
        where: { tenant_id: id, status: { in: ['ACTIVE', 'TRIALING'] } },
        data: { status: 'CANCELED', canceled_at: new Date() },
      }),
      this.prisma.subscription.create({
        data: {
          tenant_id: id,
          plan_id: dto.plan_id,
          status: 'ACTIVE',
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    await this.audit.log(AuditAction.PLAN_CHANGE, 'tenant', id, ctx, {
      old_value: { plan_id: oldPlanId },
      new_value: { plan_id: dto.plan_id },
    });

    return { tenant: updatedTenant, subscription };
  }

  async suspend(id: string, ctx: AuditContext) {
    await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENDED, is_active: false },
    });

    // Propagate to the real gym so the main app actually enforces it: the backend's
    // SubscriptionPolicy maps studios.suspended_at → 'suspended' and its global
    // SubscriptionLockGuard blocks writes; the member BFF blocks gym features.
    // Without this, "suspend" would only relabel scc.tenants (cosmetic).
    await this.setStudioSuspension(id, true);

    await this.audit.log(AuditAction.SUSPEND, 'tenant', id, ctx);
    return updated;
  }

  async activate(id: string, ctx: AuditContext) {
    await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.ACTIVE, is_active: true },
    });

    // Clear the suspension on the real gym. lifecycle_status is left to the
    // backend's policy/cron to recompute from billing (active/grace/locked).
    await this.setStudioSuspension(id, false);

    await this.audit.log(AuditAction.ACTIVATE, 'tenant', id, ctx);
    return updated;
  }

  /**
   * Write the operator suspension flag onto the linked real gym
   * (public.studios.suspended_at). The studio id is mirrored into
   * tenant.metadata.studio_id during syncFromStudios. Manually-created tenants
   * with no linked studio are a no-op. Non-fatal: a propagation hiccup must not
   * make the SCC action appear to fail after scc.tenants already moved.
   */
  private async setStudioSuspension(
    tenantId: string,
    suspended: boolean,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const studioId = (tenant?.metadata as Record<string, any> | null)?.studio_id as
      | string
      | undefined;
    if (!studioId) return;

    await this.prisma.$executeRaw`
      UPDATE public.studios
      SET suspended_at = ${suspended ? new Date() : null}, updated_at = now()
      WHERE id = ${studioId}::uuid
    `;
  }

  // ── Live operational snapshot ─────────────────────────────────────
  // The real members/branches/staff/payments live in the gym's OWN Postgres
  // schema (public.studios.schema_name, mirrored into tenant.metadata during
  // sync). SCC's DB role can read those schemas on the same connection (the
  // same way syncFromStudios reads public.studios). This pulls a read-only
  // emergency-support snapshot. Every sub-query is isolated so one empty/
  // missing table never blanks the whole panel.

  async getOperationalDetail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, metadata: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const meta = (tenant.metadata as Record<string, any> | null) ?? {};
    const schema: string | undefined = meta.schema_name;

    // Manually-created tenants (not synced from a real studio) have no schema.
    if (!schema) {
      return { available: false, reason: 'not_linked' as const };
    }
    // Hard guard: schema_name is interpolated into raw SQL, so it must match the
    // system-generated identifier shape. Anything else is rejected outright.
    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
      return { available: false, reason: 'invalid_schema' as const };
    }
    const q = `"${schema}"`;

    const [
      memberStats,
      staffStats,
      revenue,
      branches,
      memberByBranch,
      staffByBranch,
      revenueByBranch,
      recentPayments,
      recentMembers,
    ] = await Promise.all([
      this.safeRaw<{ total: number; active: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active
         FROM ${q}.members`,
      ),
      this.safeRaw<{ total: number; active: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active
         FROM ${q}.staff`,
      ),
      this.safeRaw<{ total: number; count: number; last30: number }>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total,
                COUNT(*) FILTER (WHERE paid_at IS NOT NULL)::int AS count,
                COALESCE(SUM(amount) FILTER (WHERE paid_at >= now() - interval '30 days'), 0)::float AS last30
         FROM ${q}.payments
         WHERE paid_at IS NOT NULL`,
      ),
      this.safeRaw<any>(
        `SELECT id, name, code, address, city, state, phone, email, status,
                timezone, created_at
         FROM ${q}.branches
         ORDER BY created_at ASC`,
      ),
      this.safeRaw<{ branch_id: string; total: number; active: number }>(
        `SELECT branch_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active
         FROM ${q}.members
         GROUP BY branch_id`,
      ),
      this.safeRaw<{ branch_id: string; total: number }>(
        `SELECT branch_id, COUNT(*)::int AS total
         FROM ${q}.staff
         WHERE branch_id IS NOT NULL
         GROUP BY branch_id`,
      ),
      this.safeRaw<{ branch_id: string; revenue: number }>(
        `SELECT branch_id, COALESCE(SUM(amount), 0)::float AS revenue
         FROM ${q}.payments
         WHERE paid_at IS NOT NULL
         GROUP BY branch_id`,
      ),
      this.safeRaw<any>(
        `SELECT p.id, p.amount::float AS amount, p.currency, p.status,
                p.payment_method, p.paid_at, p.created_at, m.full_name AS member_name
         FROM ${q}.payments p
         LEFT JOIN ${q}.members m ON m.id = p.member_id
         ORDER BY p.created_at DESC
         LIMIT 10`,
      ),
      this.safeRaw<any>(
        `SELECT mm.id, mm.full_name, mm.email, mm.phone, mm.status,
                mm.join_date, mm.created_at, b.name AS branch_name
         FROM ${q}.members mm
         LEFT JOIN ${q}.branches b ON b.id = mm.branch_id
         ORDER BY mm.created_at DESC
         LIMIT 10`,
      ),
    ]);

    // If we couldn't read even the member table, the schema isn't reachable.
    if (memberStats === null && branches === null) {
      return { available: false, reason: 'unreachable' as const };
    }

    const memberMap = new Map((memberByBranch ?? []).map((r) => [r.branch_id, r]));
    const staffMap = new Map((staffByBranch ?? []).map((r) => [r.branch_id, r]));
    const revMap = new Map((revenueByBranch ?? []).map((r) => [r.branch_id, r.revenue]));

    const memberAgg = memberStats?.[0];
    const staffAgg = staffStats?.[0];
    const revAgg = revenue?.[0];

    return {
      available: true as const,
      schema_name: schema,
      members: {
        total: memberAgg?.total ?? 0,
        active: memberAgg?.active ?? 0,
      },
      staff: {
        total: staffAgg?.total ?? 0,
        active: staffAgg?.active ?? 0,
      },
      revenue: {
        currency: 'INR',
        total: revAgg?.total ?? 0,
        last30Days: revAgg?.last30 ?? 0,
        paidCount: revAgg?.count ?? 0,
      },
      branches: (branches ?? []).map((b: any) => ({
        id: b.id,
        name: b.name,
        code: b.code ?? null,
        address: [b.address, b.city, b.state].filter(Boolean).join(', ') || null,
        phone: b.phone ?? null,
        email: b.email ?? null,
        status: b.status ?? null,
        timezone: b.timezone ?? null,
        memberCount: memberMap.get(b.id)?.total ?? 0,
        activeMemberCount: memberMap.get(b.id)?.active ?? 0,
        staffCount: staffMap.get(b.id)?.total ?? 0,
        revenue: revMap.get(b.id) ?? 0,
      })),
      recentPayments: (recentPayments ?? []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency ?? 'INR',
        status: p.status,
        method: p.payment_method ?? null,
        memberName: p.member_name ?? null,
        paidAt: p.paid_at,
        createdAt: p.created_at,
      })),
      recentMembers: (recentMembers ?? []).map((m: any) => ({
        id: m.id,
        name: m.full_name,
        email: m.email ?? null,
        phone: m.phone ?? null,
        status: m.status,
        branchName: m.branch_name ?? null,
        joinedAt: m.join_date ?? m.created_at,
      })),
    };
  }

  /** Run a raw read, swallowing failures (missing/empty table) → null. */
  private async safeRaw<T = any>(sql: string): Promise<T[] | null> {
    try {
      return await this.prisma.$queryRawUnsafe<T[]>(sql);
    } catch {
      return null;
    }
  }

  // ── Studios sync ──────────────────────────────────────────────────
  // The real gyms live in the main app's public.studios table. SCC owns
  // scc.tenants. This projects studios → scc.tenants (upsert by slug) so the
  // control center shows the actual customer base. Idempotent; re-runnable.

  private mapStudioStatus(s: StudioRow): TenantStatus {
    if (s.suspended_at || s.lifecycle_status === 'suspended') return TenantStatus.SUSPENDED;
    const ss = (s.subscription_status ?? '').toLowerCase();
    if (ss === 'trial' || ss === 'trialing') return TenantStatus.TRIAL;
    if (ss === 'expired' || s.lifecycle_status === 'expired') return TenantStatus.EXPIRED;
    return TenantStatus.ACTIVE;
  }

  private mapSubStatus(s: StudioRow): SubscriptionStatus {
    const ss = (s.subscription_status ?? '').toLowerCase();
    if (ss === 'trial' || ss === 'trialing') return SubscriptionStatus.TRIALING;
    if (ss === 'past_due') return SubscriptionStatus.PAST_DUE;
    if (ss === 'canceled' || ss === 'cancelled') return SubscriptionStatus.CANCELED;
    if (ss === 'expired') return SubscriptionStatus.EXPIRED;
    return SubscriptionStatus.ACTIVE;
  }

  async syncFromStudios(ctx: AuditContext) {
    const studios = await this.prisma.$queryRawUnsafe<StudioRow[]>(`
      SELECT id, name, slug, email, phone, billing_name, business_name, account_type,
             subscription_plan, subscription_status, lifecycle_status, suspended_at,
             trial_ends_at, subscription_start, subscription_expires_at, next_billing_date,
             schema_name, created_at
      FROM public.studios
    `);

    const plans = await this.prisma.subscriptionPlan.findMany();
    const planByName = new Map(plans.map((p) => [p.name.toLowerCase(), p]));

    let imported = 0;
    let updated = 0;

    for (const s of studios) {
      const plan = s.subscription_plan
        ? planByName.get(s.subscription_plan.toLowerCase())
        : undefined;
      const limits = (plan?.limits as Record<string, number> | undefined) ?? {};
      const status = this.mapStudioStatus(s);
      const ownerName =
        s.billing_name || s.business_name || (s.email ? s.email.split('@')[0] : 'Owner');

      const base = {
        name: s.name,
        owner_email: s.email ?? `${s.slug}@unknown.local`,
        owner_name: ownerName,
        phone: s.phone ?? undefined,
        account_type: s.account_type ?? 'gym',
        status,
        is_active: status !== TenantStatus.SUSPENDED,
        plan_id: plan?.id ?? null,
        trial_ends_at: s.trial_ends_at ?? null,
        metadata: { studio_id: s.id, schema_name: s.schema_name, source: 'studios' },
        ...(plan
          ? {
              max_members: limits.max_members ?? undefined,
              max_branches: limits.max_branches ?? undefined,
              max_staff: limits.max_staff ?? undefined,
            }
          : {}),
      };

      const existing = await this.prisma.tenant.findUnique({ where: { slug: s.slug } });
      const tenant = existing
        ? ((updated++), await this.prisma.tenant.update({ where: { id: existing.id }, data: base }))
        : ((imported++),
          await this.prisma.tenant.create({ data: { slug: s.slug, created_at: s.created_at, ...base } }));

      if (plan) {
        const start = s.subscription_start ?? s.created_at;
        const end =
          s.subscription_expires_at ??
          s.next_billing_date ??
          s.trial_ends_at ??
          new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
        const subData = {
          plan_id: plan.id,
          status: this.mapSubStatus(s),
          start_date: start,
          end_date: end,
          auto_renew: this.mapSubStatus(s) === SubscriptionStatus.ACTIVE,
        };
        const sub = await this.prisma.subscription.findFirst({ where: { tenant_id: tenant.id } });
        if (sub) {
          await this.prisma.subscription.update({ where: { id: sub.id }, data: subData });
        } else {
          await this.prisma.subscription.create({ data: { tenant_id: tenant.id, ...subData } });
        }
      }
    }

    await this.audit.log(AuditAction.UPDATE, 'tenant', null, ctx, {
      new_value: { synced_from: 'public.studios', imported, updated, total: studios.length },
    });

    return { imported, updated, total: studios.length };
  }
}

interface StudioRow {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  billing_name: string | null;
  business_name: string | null;
  account_type: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  lifecycle_status: string | null;
  suspended_at: Date | null;
  trial_ends_at: Date | null;
  subscription_start: Date | null;
  subscription_expires_at: Date | null;
  next_billing_date: Date | null;
  schema_name: string | null;
  created_at: Date;
}
