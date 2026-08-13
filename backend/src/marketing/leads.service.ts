import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { CreateLeadDto, UpdateLeadDto, CreateLeadActivityDto } from './dto';
import { getTenantGymId } from '../common/tenant-context';
import { AUTOMATION_EVENTS, LeadCreatedPayload } from './automation-dispatcher.service';
import { MembersService } from '../members/members.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly tenant: TenantPrisma,
    private readonly events: EventEmitter2,
    private readonly members: MembersService,
  ) {}

  /**
   * Normalize a phone to its last 10 digits so `+91 98765 43210`,
   * `098765 43210` and `9876543210` all collide. Deliberately loose —
   * this powers a WARNING, never a hard block.
   */
  private phoneKey(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits || null;
  }

  /**
   * Possible duplicates of a prospect, by phone or email, across BOTH existing
   * leads and existing members. There was no dedupe of any kind before, so the
   * same walk-in enquired twice became two leads and (worse) a lead could be
   * "converted" into a second member row for someone who already trains here.
   */
  async findDuplicates(input: {
    phone?: string | null;
    email?: string | null;
    excludeLeadId?: string;
  }) {
    const key = this.phoneKey(input.phone);
    const email = input.email?.trim().toLowerCase() || null;
    if (!key && !email) return { leads: [], members: [] };

    // Phones are stored RAW and inconsistently ("+91 98765 43210",
    // "09876543210", "9876543210"), so a `contains` on the normalized key
    // misses anything with separators. Prefilter on the last 4 digits — those
    // are contiguous in essentially every format — then compare properly
    // normalized keys in JS. Wider `take` because the prefilter is coarse.
    const last4 = key ? key.slice(-4) : null;
    const phoneWhere = last4 ? [{ phone: { contains: last4 } }] : [];
    const emailWhere = email
      ? [{ email: { equals: email, mode: 'insensitive' as const } }]
      : [];

    const [leadRows, memberRows] = await Promise.all([
      this.tenant.client.lead.findMany({
        where: {
          ...(input.excludeLeadId ? { id: { not: input.excludeLeadId } } : {}),
          OR: [...phoneWhere, ...emailWhere],
        },
        select: {
          id: true,
          full_name: true,
          phone: true,
          email: true,
          status: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 25,
      }),
      this.tenant.client.member.findMany({
        where: { OR: [...phoneWhere, ...emailWhere] },
        select: {
          id: true,
          full_name: true,
          member_code: true,
          phone: true,
          email: true,
          status: true,
        },
        take: 25,
      }),
    ]);

    /** Keep rows whose NORMALIZED phone matches, or whose email matches. */
    const matches = (row: { phone?: string | null; email?: string | null }) => {
      if (key && this.phoneKey(row.phone) === key) return true;
      if (email && row.email && row.email.trim().toLowerCase() === email) return true;
      return false;
    };

    return {
      leads: leadRows.filter(matches).slice(0, 5),
      members: memberRows.filter(matches).slice(0, 5),
    };
  }

  /**
   * One-tap lead → member conversion.
   *
   * Previously `converted_member_id` could only be set by pasting a raw UUID
   * into a PATCH — staff had to create the member separately and wire it up by
   * hand, so in practice conversion tracking was never populated.
   *
   * Creates the member from the lead's own contact details, links both sides,
   * flips the lead to `converted`, and records an activity. Refuses when the
   * lead is already converted, and refuses a duplicate phone unless the caller
   * explicitly links to the existing member instead.
   */
  async convertToMember(
    studioId: string,
    id: string,
    input: {
      branch_id?: string;
      /** Link to an existing member instead of creating one. */
      existing_member_id?: string;
      /** Acting user — resolved to a Staff row for the activity log. */
      user_id?: string;
    },
  ) {
    const lead = await this.tenant.client.lead.findFirst({
      where: { id, gym_id: getTenantGymId()! },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.converted_member_id) {
      throw new BadRequestException('This lead has already been converted');
    }

    let memberId = input.existing_member_id;
    let memberName: string | null = null;

    if (!memberId) {
      if (!lead.phone) {
        throw new BadRequestException(
          'This lead has no phone number — add one before converting',
        );
      }
      const branchId = input.branch_id ?? lead.branch_id;
      if (!branchId) {
        throw new BadRequestException('A branch is required to create the member');
      }

      // Hard-stop on an existing member with the same phone: creating a second
      // row for the same person is worse than failing loudly.
      const dupes = await this.findDuplicates({ phone: lead.phone, excludeLeadId: id });
      if (dupes.members.length > 0) {
        throw new BadRequestException(
          `A member with this phone already exists (${dupes.members[0].full_name}, ` +
            `${dupes.members[0].member_code}). Link the lead to them instead.`,
        );
      }

      const created = await this.members.create(studioId, {
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email ?? undefined,
        branch_id: branchId,
        organization_id: lead.organization_id ?? undefined,
        status: 'active',
      } as Parameters<MembersService['create']>[1]);
      memberId = created.id;
      memberName = created.full_name;
    }

    const updated = await this.tenant.client.lead.update({
      where: { id },
      data: {
        converted_member_id: memberId,
        status: 'converted',
      },
      include: {
        converted_member: { select: { id: true, full_name: true, member_code: true } },
      },
    });

    // LeadActivity.staff_id references Staff, but the JWT only carries the
    // auth user id — resolve it (best-effort; the log is not worth failing on).
    const actingStaffId = input.user_id
      ? (
          await this.tenant.client.staff.findFirst({
            where: { user_id: input.user_id },
            select: { id: true },
          })
        )?.id
      : undefined;

    await this.tenant.client.leadActivity.create({
      data: {
        gym_id: getTenantGymId()!,
        lead_id: id,
        staff_id: actingStaffId,
        activity_type: 'status_change',
        notes: input.existing_member_id
          ? `Linked to existing member ${updated.converted_member?.full_name ?? ''}`.trim()
          : `Converted to member ${memberName ?? ''}`.trim(),
      },
    });

    return updated;
  }

  async create(dto: CreateLeadDto) {
    const lead = await this.tenant.client.lead.create({
      data: { ...dto, gym_id: getTenantGymId()! },
      include: {
        branch: { select: { id: true, name: true } },
        assigned_staff: { select: { id: true, full_name: true } },
      },
    });

    // Log creation activity
    await this.tenant.client.leadActivity.create({
      data: {
        gym_id: getTenantGymId()!,
        lead_id: lead.id,
        staff_id: dto.assigned_staff_id,
        activity_type: 'note',
        notes: 'Lead created',
      },
    });

    // Fire the lead_created automation trigger (async listeners; never blocks).
    this.events.emit(AUTOMATION_EVENTS.LEAD_CREATED, {
      gymId: getTenantGymId()!,
      leadId: lead.id,
      fullName: lead.full_name,
      phone: lead.phone,
      email: lead.email,
    } satisfies LeadCreatedPayload);

    return lead;
  }

  async findAll(filters: {
    organization_id?: string;
    branch_id?: string;
    status?: string;
    lead_source?: string;
    assigned_staff_id?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      organization_id, branch_id, status, lead_source,
      assigned_staff_id, search, page = 1, limit = 50,
    } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (organization_id) where.organization_id = organization_id;
    if (branch_id) where.branch_id = branch_id;
    if (status) where.status = status;
    if (lead_source) where.lead_source = lead_source;
    if (assigned_staff_id) where.assigned_staff_id = assigned_staff_id;
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.tenant.client.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
          assigned_staff: { select: { id: true, full_name: true } },
          _count: { select: { activities: true } },
        },
      }),
      this.tenant.client.lead.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const lead = await this.tenant.client.lead.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        assigned_staff: { select: { id: true, full_name: true } },
        converted_member: { select: { id: true, full_name: true } },
        activities: {
          orderBy: { created_at: 'desc' },
          take: 20,
          include: { staff: { select: { id: true, full_name: true } } },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    const lead = await this.tenant.client.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Log status change
    if (dto.status && dto.status !== lead.status) {
      await this.tenant.client.leadActivity.create({
        data: {
          gym_id: getTenantGymId()!,
          lead_id: id,
          activity_type: 'status_change',
          notes: `Status changed from ${lead.status} to ${dto.status}`,
        },
      });
    }

    // Log reassignment. Previously `assigned_staff_id` changed silently, so
    // the timeline showed status history but never who a lead moved between.
    if (
      dto.assigned_staff_id !== undefined &&
      dto.assigned_staff_id !== lead.assigned_staff_id
    ) {
      const [from, to] = await Promise.all([
        lead.assigned_staff_id
          ? this.tenant.client.staff.findFirst({
              where: { id: lead.assigned_staff_id },
              select: { full_name: true },
            })
          : Promise.resolve(null),
        dto.assigned_staff_id
          ? this.tenant.client.staff.findFirst({
              where: { id: dto.assigned_staff_id },
              select: { full_name: true },
            })
          : Promise.resolve(null),
      ]);
      await this.tenant.client.leadActivity.create({
        data: {
          gym_id: getTenantGymId()!,
          lead_id: id,
          staff_id: dto.assigned_staff_id ?? undefined,
          activity_type: 'note',
          notes: to
            ? `Assigned to ${to.full_name}${from ? ` (was ${from.full_name})` : ''}`
            : `Unassigned${from ? ` from ${from.full_name}` : ''}`,
        },
      });
    }

    return this.tenant.client.lead.update({
      where: { id },
      data: dto,
      include: {
        branch: { select: { id: true, name: true } },
        assigned_staff: { select: { id: true, full_name: true } },
      },
    });
  }

  async addActivity(dto: CreateLeadActivityDto) {
    const lead = await this.tenant.client.lead.findUnique({ where: { id: dto.lead_id } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.tenant.client.leadActivity.create({
      data: { ...dto, gym_id: getTenantGymId()! },
      include: { staff: { select: { id: true, full_name: true } } },
    });
  }

  async getActivities(leadId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.tenant.client.leadActivity.findMany({
        where: { lead_id: leadId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { staff: { select: { id: true, full_name: true } } },
      }),
      this.tenant.client.leadActivity.count({ where: { lead_id: leadId } }),
    ]);
    return { data, total, page, limit };
  }

  async getFunnelAnalytics(filters: {
    organization_id?: string;
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const { organization_id, branch_id, start_date, end_date } = filters;
    const where: any = {};

    if (organization_id) where.organization_id = organization_id;
    if (branch_id) where.branch_id = branch_id;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [totalLeads, byStatus, bySource] = await Promise.all([
      this.tenant.client.lead.count({ where }),
      this.tenant.client.lead.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.tenant.client.lead.groupBy({
        by: ['lead_source'],
        where,
        _count: { id: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) statusMap[s.status] = s._count.id;

    const sourceMap: Record<string, number> = {};
    for (const s of bySource) sourceMap[s.lead_source] = s._count.id;

    const converted = statusMap['converted'] ?? 0;
    const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;

    return {
      total_leads: totalLeads,
      by_status: statusMap,
      by_source: sourceMap,
      conversion_rate: Math.round(conversionRate * 100) / 100,
      funnel: {
        new: statusMap['new'] ?? 0,
        contacted: statusMap['contacted'] ?? 0,
        trial_scheduled: statusMap['trial_scheduled'] ?? 0,
        converted,
        lost: statusMap['lost'] ?? 0,
      },
    };
  }
}
