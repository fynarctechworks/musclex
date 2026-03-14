import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto, UpdateMemberDto, FreezeMemberDto, RenewMemberDto } from './dto';
import { randomUUID, randomInt } from 'crypto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  private generateMemberCode(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomInt(1000, 9999);
    return `FS-${date}-${rand}`;
  }

  private stripSensitive(member: any) {
    const { face_descriptor, ...safe } = member;
    return safe;
  }

  // ── List Members ──────────────────────────────────────────────

  async findAll(query: {
    status?: string;
    branch_id?: string;
    organization_id?: string;
    search?: string;
    tag_id?: string;
    trainer_id?: string;
    churn_risk?: string;
    page?: number;
    limit?: number;
    user_branch_ids?: string[];
  }) {
    const {
      status, branch_id, organization_id, search, tag_id, trainer_id,
      churn_risk, page = 1, limit = 50, user_branch_ids,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (organization_id) where.organization_id = organization_id;
    if (churn_risk) where.churn_risk = churn_risk;

    if (branch_id) {
      where.branch_id = branch_id;
    } else if (user_branch_ids && user_branch_ids.length > 0) {
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

    if (trainer_id) {
      where.trainer_clients = { some: { trainer_id, status: 'active' } };
    }

    const [rawData, total] = await Promise.all([
      this.prisma.member.findMany({
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
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.member.count({ where }),
    ]);

    const data = rawData.map((m) => this.stripSensitive(m));
    return { data, total, page, limit };
  }

  // ── 360° Member View ──────────────────────────────────────────

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
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

  // ── Create Member ─────────────────────────────────────────────

  async create(dto: CreateMemberDto) {
    const memberCode = this.generateMemberCode();
    const qrCode = randomUUID();

    const member = await this.prisma.member.create({
      data: {
        member_code: memberCode,
        organization_id: dto.organization_id,
        branch_id: dto.branch_id,
        full_name: dto.full_name,
        phone: dto.phone,
        email: dto.email,
        gender: dto.gender,
        date_of_birth: dto.date_of_birth ? new Date(dto.date_of_birth) : null,
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

    let membership = null;
    if (dto.plan_id) {
      const plan = await this.prisma.membershipPlan.findUnique({
        where: { id: dto.plan_id },
      });
      if (!plan) throw new BadRequestException('Invalid plan');

      const startDate = dto.membership_start_date
        ? new Date(dto.membership_start_date)
        : new Date();
      const endDate = plan.duration_days
        ? new Date(startDate.getTime() + plan.duration_days * 86400000)
        : null;

      membership = await this.prisma.memberMembership.create({
        data: {
          member_id: member.id,
          plan_id: dto.plan_id,
          branch_id: dto.branch_id,
          start_date: startDate,
          end_date: endDate,
          classes_remaining: plan.total_classes,
          status: 'active',
        },
        include: { plan: true },
      });
    }

    return { ...member, membership };
  }

  // ── Update Member ─────────────────────────────────────────────

  async update(id: string, dto: UpdateMemberDto) {
    await this.findOne(id);
    const updated = await this.prisma.member.update({
      where: { id },
      data: {
        ...dto,
        date_of_birth: dto.date_of_birth ? new Date(dto.date_of_birth) : undefined,
        join_date: dto.join_date ? new Date(dto.join_date) : undefined,
      },
      include: { branch: true },
    });
    return this.stripSensitive(updated);
  }

  // ── Soft Delete ───────────────────────────────────────────────

  async softDelete(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.member.update({
      where: { id },
      data: { status: 'cancelled' },
      select: { id: true, status: true },
    });
  }

  // ── Freeze / Unfreeze ─────────────────────────────────────────

  async freeze(id: string, dto: FreezeMemberDto) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: { memberships: { where: { status: 'active' }, take: 1 } },
    });
    if (!member) throw new NotFoundException('Member not found');

    const activeMembership = member.memberships[0];
    if (!activeMembership) throw new BadRequestException('No active membership to freeze');

    const updated = await this.prisma.memberMembership.update({
      where: { id: activeMembership.id },
      data: {
        status: 'frozen',
        freeze_start_date: new Date(dto.freeze_start_date),
        freeze_end_date: new Date(dto.freeze_end_date),
        freeze_reason: dto.reason,
      },
      include: { plan: true },
    });

    await this.prisma.member.update({
      where: { id },
      data: { status: 'frozen' },
    });

    return updated;
  }

  async unfreeze(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: { memberships: { where: { status: 'frozen' }, take: 1 } },
    });
    if (!member) throw new NotFoundException('Member not found');

    const frozenMembership = member.memberships[0];
    if (!frozenMembership) throw new BadRequestException('No frozen membership found');

    // Calculate days frozen and extend end_date accordingly
    const freezeStart = frozenMembership.freeze_start_date;
    const now = new Date();
    const frozenDays = freezeStart
      ? Math.ceil((now.getTime() - freezeStart.getTime()) / 86400000)
      : 0;

    const newEndDate = frozenMembership.end_date && frozenDays > 0
      ? new Date(frozenMembership.end_date.getTime() + frozenDays * 86400000)
      : frozenMembership.end_date;

    const updated = await this.prisma.memberMembership.update({
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

    await this.prisma.member.update({
      where: { id },
      data: { status: 'active' },
    });

    return { ...updated, frozen_days_added: frozenDays };
  }

  // ── Renew Membership ──────────────────────────────────────────

  async renew(id: string, dto: RenewMemberDto) {
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id: dto.plan_id },
    });
    if (!plan) throw new BadRequestException('Invalid plan');

    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    const startDate = new Date();
    const endDate = plan.duration_days
      ? new Date(startDate.getTime() + plan.duration_days * 86400000)
      : null;

    const membership = await this.prisma.memberMembership.create({
      data: {
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

    const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomInt(1000, 9999)}`;
    const payment = await this.prisma.payment.create({
      data: {
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

    await this.prisma.member.update({
      where: { id },
      data: { status: 'active' },
    });

    return { membership, payment };
  }

  // ── Face Descriptor ───────────────────────────────────────────

  async saveFaceDescriptor(id: string, descriptor: number[]) {
    await this.findOne(id);
    await this.prisma.member.update({
      where: { id },
      data: { face_descriptor: descriptor },
    });
    return { success: true };
  }

  // ── Churn Risk ────────────────────────────────────────────────

  async getChurnRisk(risk?: string) {
    const where: any = {};
    if (risk) where.churn_risk = risk;

    return this.prisma.member.findMany({
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

  async getVisitStats(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    const [total, last30, last90, lastVisit] = await Promise.all([
      this.prisma.checkIn.count({ where: { member_id: memberId } }),
      this.prisma.checkIn.count({
        where: { member_id: memberId, checked_in_at: { gte: thirtyDaysAgo } },
      }),
      this.prisma.checkIn.count({
        where: { member_id: memberId, checked_in_at: { gte: ninetyDaysAgo } },
      }),
      this.prisma.checkIn.findFirst({
        where: { member_id: memberId },
        orderBy: { checked_in_at: 'desc' },
        select: { checked_in_at: true, branch: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      total_visits: total,
      visits_last_30_days: last30,
      visits_last_90_days: last90,
      avg_visits_per_week: last30 > 0 ? Math.round((last30 / 4.3) * 10) / 10 : 0,
      last_visit: lastVisit,
    };
  }

  // ── Member Lifecycle Summary ──────────────────────────────────

  async getLifecycleSummary(filters?: { branch_id?: string; organization_id?: string }) {
    const where: any = {};
    if (filters?.branch_id) where.branch_id = filters.branch_id;
    if (filters?.organization_id) where.organization_id = filters.organization_id;

    const statuses = ['lead', 'trial', 'active', 'inactive', 'cancelled', 'frozen', 'expiring_soon', 'expired'];
    const counts = await Promise.all(
      statuses.map((s) =>
        this.prisma.member.count({ where: { ...where, status: s } }),
      ),
    );

    const total = await this.prisma.member.count({ where });
    const summary: Record<string, number> = {};
    statuses.forEach((s, i) => { summary[s] = counts[i]; });

    return { total, by_status: summary };
  }
}
