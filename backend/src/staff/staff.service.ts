import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { JwtPayload, ResourceLimitService, resolveBranchScope } from '../common';
import { EventStoreService } from '../events/event-store.service';
import { EventProjectorService } from '../events/event-projector.service';
import { getTenantGymId } from '../common/tenant-context';
import { StaffInviteService } from './staff-invite.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { CreateStaffShiftDto, UpdateStaffShiftDto } from './dto/create-staff-shift.dto';
import { CreateLeaveRequestDto, ReviewLeaveRequestDto } from './dto/leave-request.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private pub: PublicPrismaService,
    private tenant: TenantPrisma,
    private configService: ConfigService,
    private resourceLimits: ResourceLimitService,
    private eventStore: EventStoreService,
    private eventProjector: EventProjectorService,
    @Inject(forwardRef(() => StaffInviteService))
    private inviteService: StaffInviteService,
    private emailService: EmailService,
  ) {}

  private stripSalary(staff: any, userRole: string): any {
    if (userRole === 'owner') return staff;
    const { salary, payroll_config, ...rest } = staff;
    return rest;
  }

  // ── Staff CRUD ────────────────────────────────────────────────

  async findAll(
    studioId: string,
    query: {
      branch_id?: string;
      organization_id?: string;
      role?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user: JwtPayload,
  ) {
    const { branch_id, organization_id, role, status, search, page = 1, limit = 50 } = query;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;

    const where: any = {}; // Tenant isolation handled by SET search_path in TenantMiddleware
    if (role) where.role = role;
    if (status) where.status = status;
    if (organization_id) where.organization_id = organization_id;

    // Global access = role is owner/brand_owner OR any role row with branch_id=null.
    const scope = resolveBranchScope(user, branch_id);
    if (branch_id) {
      if (!scope.hasGlobalAccess && scope.allowedIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      where.OR = [
        { branch_id },
        { branch_ids: { has: branch_id } },
      ];
    } else if (!scope.hasGlobalAccess) {
      if (scope.allowedIds === 'ALL' || scope.allowedIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      where.OR = scope.allowedIds.flatMap((bid: string) => [
        { branch_id: bid },
        { branch_ids: { has: bid } },
      ]);
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { full_name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
            { employee_code: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.tenant.client.staff.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
        include: {
          organization: { select: { id: true, name: true } },
          primary_branch: { select: { id: true, name: true, code: true } },
          profile: true,
          _count: { select: { trainer_clients: true, trainer_sessions: true } },
        },
      }),
      this.tenant.client.staff.count({ where }),
    ]);

    return {
      data: data.map((s) => this.stripSalary(s, user.role)),
      total,
      page,
      limit,
    };
  }

  async findOne(studioId: string, id: string, userRole: string) {
    const staff = await this.tenant.client.staff.findFirst({
      where: { id, },
      include: {
        organization: { select: { id: true, name: true } },
        primary_branch: { select: { id: true, name: true, code: true } },
        profile: true,
        payroll_config: true,
        _count: {
          select: {
            trainer_clients: true,
            trainer_sessions: true,
            attendance: true,
          },
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return this.stripSalary(staff, userRole);
  }

  async create(studioId: string, data: CreateStaffDto, createdBy?: string) {
    // Resolve organization_id — if not provided, find the first org in the tenant schema
    let organizationId = data.organization_id;
    if (!organizationId) {
      const org = await this.tenant.client.organization.findFirst({ select: { id: true } });
      organizationId = org?.id;
    }

    // Enforce plan-based staff limit and feature access before creation
    await this.resourceLimits.checkFeatureAccess(studioId, 'staff_management');
    await this.resourceLimits.checkStaffLimit(studioId, organizationId);

    // Auto-generate employee_code: EMP-{gymShort}-{seq}
    // gymShort = first 6 hex chars of the tenant gym_id (uppercase), so codes
    // stay unique across gyms even if the schema is ever merged.
    const gymId = getTenantGymId()!;
    const gymShort = gymId.replace(/-/g, '').slice(0, 6).toUpperCase();
    const staffCount = await this.tenant.client.staff.count();
    let attempt = staffCount + 1;
    let employeeCode = `EMP-${gymShort}-${String(attempt).padStart(4, '0')}`;
    let existing = await this.tenant.client.staff.findFirst({
      where: { employee_code: employeeCode },
    });
    while (existing) {
      attempt++;
      employeeCode = `EMP-${gymShort}-${String(attempt).padStart(4, '0')}`;
      existing = await this.tenant.client.staff.findFirst({
        where: { employee_code: employeeCode },
      });
    }

    // If branch_id not provided but branch_ids has entries, use the first as primary
    const primaryBranchId = data.branch_id ?? data.branch_ids?.[0];

    const staff = await this.tenant.client.staff.create({
      data: {
        gym_id: getTenantGymId()!,
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        email: data.email,
        user_id: data.user_id,
        organization_id: organizationId,
        branch_id: primaryBranchId,
        branch_ids: data.branch_ids || [],
        employee_code: employeeCode,
        job_title: data.job_title,
        employment_type: data.employment_type ?? 'full_time',
        specializations: data.specializations || [],
        salary: data.salary,
        joined_at: data.joined_at ? new Date(data.joined_at) : new Date(),
      },
    });

    // Auto-create empty profile for trainers
    if (data.role === 'trainer') {
      await this.tenant.client.staffProfile.create({
        data: {
          gym_id: getTenantGymId()!,
          staff_id: staff.id,
          specializations: data.specializations || [],
        },
      });
    }

    // Emit STAFF_CREATED event — must succeed
    const event = await this.tenant.client.$transaction(async (tx) => {
      return this.eventStore.emit(tx, {
        aggregate_type: 'staff',
        aggregate_id: staff.id,
        event_type: 'STAFF_CREATED',
        payload: { staff_id: staff.id, full_name: staff.full_name, role: data.role, branch_id: primaryBranchId },
        branch_id: primaryBranchId,
      });
    });

    this.eventProjector.processEvent({
      id: event.id,
      gym_id: getTenantGymId()!,
      event_type: 'STAFF_CREATED',
      payload: { full_name: staff.full_name, role: data.role },
      branch_id: primaryBranchId,
      version: event.version,
    }).catch((err) => {
      this.logger.error(`Projection failed for STAFF_CREATED (event=${event.id}): ${(err as Error).message}`);
    });

    // Auto-send invite if send_invite=true and email is provided
    if (data.send_invite && data.email) {
      try {
        await this.inviteService.createInvite({
          staff_id: staff.id,
          studio_id: studioId,
          email: data.email,
          role_name: data.role,
          branch_id: primaryBranchId,
          permission_overrides: {
            grants: data.permission_grants,
            denials: data.permission_denials,
          },
          invited_by: createdBy || staff.id,
        });
      } catch (err) {
        this.logger.warn(`Auto-invite failed for ${data.email}: ${(err as Error).message}`);
      }
    }

    return this.findOne(studioId, staff.id, 'owner');
  }

  async update(studioId: string, id: string, data: UpdateStaffDto) {
    const existing = await this.tenant.client.staff.findFirst({
      where: { id, },
    });
    if (!existing) throw new NotFoundException('Staff member not found');

    // Check employee_code uniqueness if changing
    if (data.employee_code && data.employee_code !== existing.employee_code) {
      const conflict = await this.tenant.client.staff.findFirst({
        where: { employee_code: data.employee_code, },
      });
      if (conflict) throw new ConflictException('Employee code already exists');
    }

    const updateData: any = { ...data };
    if (data.joined_at) {
      updateData.joined_at = new Date(data.joined_at);
    }

    await this.tenant.client.staff.update({ where: { id }, data: updateData });
    return this.findOne(studioId, id, 'owner');
  }

  /**
   * Update the set of branches a staff member has access to.
   * Owner/brand_owner only. Syncs both tenant.staff (branch_id + branch_ids[])
   * and public.user_roles so the next login rebuilds JWT.branch_ids correctly.
   */
  async updateBranchAccess(studioId: string, staffId: string, branchIds: string[]) {
    const staff = await this.tenant.client.staff.findFirst({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    // Validate every branch exists in this studio
    if (branchIds.length > 0) {
      const found = await this.tenant.client.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true },
      });
      if (found.length !== branchIds.length) {
        throw new BadRequestException('One or more branch_ids do not belong to this studio');
      }
    }

    const unique = Array.from(new Set(branchIds));
    const primaryBranchId = unique[0] ?? null;

    // 1. Update tenant.staff
    await this.tenant.client.staff.update({
      where: { id: staffId },
      data: {
        branch_id: primaryBranchId,
        branch_ids: unique,
      },
    });

    // 2. Sync public.user_roles if the staff has logged in (has user_id)
    if (staff.user_id) {
      // Preserve any gym-wide (branch_id=null) role, drop branch-scoped roles, then re-create for each new branch.
      await this.pub.userRole.deleteMany({
        where: {
          user_id: staff.user_id,
          studio_id: studioId,
          branch_id: { not: null },
        },
      });

      for (const [idx, bid] of unique.entries()) {
        await this.pub.userRole.create({
          data: {
            user_id: staff.user_id,
            studio_id: studioId,
            branch_id: bid,
            role_name: staff.role,
            is_primary: idx === 0,
          },
        });
      }
    }

    // 3. If there's a still-pending invite, update its branch_id so the accept flow lands on the new primary
    if (!staff.user_id) {
      const pending = await this.pub.staffInvitation.findFirst({
        where: { staff_id: staffId, studio_id: studioId, status: 'pending' },
      });
      if (pending) {
        await this.pub.staffInvitation.update({
          where: { id: pending.id },
          data: { branch_id: primaryBranchId },
        });
      }
    }

    return this.findOne(studioId, staffId, 'owner');
  }

  async deactivate(studioId: string, id: string) {
    const existing = await this.tenant.client.staff.findFirst({
      where: { id, },
    });
    if (!existing) throw new NotFoundException('Staff member not found');

    const result = await this.tenant.client.staff.update({
      where: { id },
      data: { is_active: false, status: 'inactive' },
    });

    if (existing.is_active) {
      const event = await this.tenant.client.$transaction(async (tx) => {
        return this.eventStore.emit(tx, {
          aggregate_type: 'staff',
          aggregate_id: id,
          event_type: 'STAFF_DEACTIVATED',
          payload: { staff_id: id },
          branch_id: existing.branch_id,
        });
      });

      this.eventProjector.processEvent({
        id: event.id,
        gym_id: getTenantGymId()!,
        event_type: 'STAFF_DEACTIVATED',
        payload: {},
        branch_id: existing.branch_id,
        version: event.version,
      }).catch((err) => {
        this.logger.error(`Projection failed for STAFF_DEACTIVATED (event=${event.id}): ${(err as Error).message}`);
      });
    }

    return result;
  }

  // ── Staff Profile ─────────────────────────────────────────────

  async getProfile(studioId: string, staffId: string) {
    // Verify staff belongs to studio
    const staff = await this.tenant.client.staff.findFirst({
      where: { id: staffId, },
    });
    if (!staff) throw new NotFoundException('Staff member not found in studio');

    const profile = await this.tenant.client.staffProfile.findUnique({
      where: { staff_id: staffId },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');
    return profile;
  }

  async updateProfile(studioId: string, staffId: string, dto: UpdateStaffProfileDto) {
    const staff = await this.tenant.client.staff.findFirst({
      where: { id: staffId, },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.tenant.client.staffProfile.upsert({
      where: { staff_id: staffId },
      update: dto,
      create: {
        gym_id: getTenantGymId()!,
        staff_id: staffId,
        bio: dto.bio,
        certifications: dto.certifications ?? [],
        specializations: dto.specializations ?? [],
        experience_years: dto.experience_years ?? 0,
        profile_photo: dto.profile_photo,
      },
    });
  }

  // ── Availability ──────────────────────────────────────────────

  async getAvailability(staffId: string) {
    return this.tenant.client.staffAvailability.findMany({
      where: { staff_id: staffId },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
  }

  async setAvailability(staffId: string, slots: SetAvailabilityDto[]) {
    const staff = await this.tenant.client.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    // Replace all availability for this staff member
    await this.tenant.client.$transaction(async (tx) => {
      await tx.staffAvailability.deleteMany({ where: { staff_id: staffId } });
      await tx.staffAvailability.createMany({
        data: slots.map((s) => ({
          gym_id: getTenantGymId()!,
          staff_id: staffId,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          availability_type: s.availability_type ?? 'available',
        })),
      });
    });

    return this.getAvailability(staffId);
  }

  // ── Attendance ────────────────────────────────────────────────

  async getAttendance(
    staffId: string,
    filters?: { start_date?: string; end_date?: string; branch_id?: string },
  ) {
    const where: any = { staff_id: staffId };
    if (filters?.branch_id) where.branch_id = filters.branch_id;
    if (filters?.start_date || filters?.end_date) {
      where.check_in_time = {};
      if (filters.start_date) where.check_in_time.gte = new Date(filters.start_date);
      if (filters.end_date) where.check_in_time.lte = new Date(filters.end_date);
    }

    return this.tenant.client.staffAttendance.findMany({
      where,
      orderBy: { check_in_time: 'desc' },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async recordCheckIn(dto: RecordAttendanceDto) {
    const staff = await this.tenant.client.staff.findUnique({ where: { id: dto.staff_id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.tenant.client.staffAttendance.create({
      data: {
        gym_id: getTenantGymId()!,
        staff_id: dto.staff_id,
        branch_id: dto.branch_id,
        check_in_time: dto.check_in_time ? new Date(dto.check_in_time) : new Date(),
        method: dto.method ?? 'manual',
        notes: dto.notes,
      },
    });
  }

  async recordCheckOut(attendanceId: string) {
    const record = await this.tenant.client.staffAttendance.findUnique({
      where: { id: attendanceId },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (record.check_out_time) throw new ConflictException('Already checked out');

    return this.tenant.client.staffAttendance.update({
      where: { id: attendanceId },
      data: { check_out_time: new Date() },
    });
  }

  // ── Staff Shifts ──────────────────────────────────────────────

  async createShift(dto: CreateStaffShiftDto) {
    const staff = await this.tenant.client.staff.findUnique({ where: { id: dto.staff_id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    // Check for overlapping shifts on the same date
    const existing = await this.tenant.client.staffShift.findFirst({
      where: {
        staff_id: dto.staff_id,
        shift_date: new Date(dto.shift_date),
        OR: [
          { start_time: { lt: dto.end_time }, end_time: { gt: dto.start_time } },
        ],
      },
    });
    if (existing) throw new ConflictException('Shift overlaps with an existing shift');

    return this.tenant.client.staffShift.create({
      data: {
        gym_id: getTenantGymId()!,
        staff_id: dto.staff_id,
        branch_id: dto.branch_id,
        shift_date: new Date(dto.shift_date),
        start_time: dto.start_time,
        end_time: dto.end_time,
        shift_type: dto.shift_type ?? 'regular',
        notes: dto.notes,
      },
      include: {
        staff: { select: { id: true, full_name: true, employee_code: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async getShifts(filters: {
    staff_id?: string;
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const where: any = {};
    if (filters.staff_id) where.staff_id = filters.staff_id;
    if (filters.branch_id) where.branch_id = filters.branch_id;
    if (filters.start_date || filters.end_date) {
      where.shift_date = {};
      if (filters.start_date) where.shift_date.gte = new Date(filters.start_date);
      if (filters.end_date) where.shift_date.lte = new Date(filters.end_date);
    }

    return this.tenant.client.staffShift.findMany({
      where,
      orderBy: [{ shift_date: 'asc' }, { start_time: 'asc' }],
      include: {
        staff: { select: { id: true, full_name: true, employee_code: true, role: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async updateShift(id: string, dto: UpdateStaffShiftDto) {
    const shift = await this.tenant.client.staffShift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');

    return this.tenant.client.staffShift.update({
      where: { id },
      data: dto,
      include: {
        staff: { select: { id: true, full_name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async deleteShift(id: string) {
    const shift = await this.tenant.client.staffShift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.tenant.client.staffShift.delete({ where: { id } });
  }

  // ── Leave Management ──────────────────────────────────────────

  async createLeaveRequest(dto: CreateLeaveRequestDto) {
    const staff = await this.tenant.client.staff.findUnique({ where: { id: dto.staff_id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);
    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }

    // Check for overlapping leave requests (pending or approved)
    const overlap = await this.tenant.client.leaveRequest.findFirst({
      where: {
        staff_id: dto.staff_id,
        status: { in: ['pending', 'approved'] },
        start_date: { lte: endDate },
        end_date: { gte: startDate },
      },
    });
    if (overlap) throw new ConflictException('Overlapping leave request already exists');

    const gymId = getTenantGymId()!;

    const leaveRequest = await this.tenant.client.leaveRequest.create({
      data: {
        gym_id: gymId,
        staff_id: dto.staff_id,
        leave_type: dto.leave_type,
        start_date: startDate,
        end_date: endDate,
        reason: dto.reason,
      },
      include: {
        staff: { select: { id: true, full_name: true, employee_code: true } },
      },
    });

    // Send notifications (non-blocking)
    const allRecipientIds = [
      ...(dto.notify_to || []),
      ...(dto.notify_cc || []),
    ];

    if (allRecipientIds.length > 0) {
      this.sendLeaveNotifications({
        leaveRequest,
        staffName: staff.full_name,
        leaveType: dto.leave_type,
        startDate: dto.start_date,
        endDate: dto.end_date,
        reason: dto.reason,
        notifyTo: dto.notify_to || [],
        notifyCc: dto.notify_cc || [],
        gymId,
      }).catch((err) => {
        this.logger.error(`Leave notification failed: ${err.message}`);
      });
    }

    return leaveRequest;
  }

  /**
   * Send in-app notifications + emails for a leave request.
   */
  private async sendLeaveNotifications(params: {
    leaveRequest: any;
    staffName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason?: string;
    notifyTo: string[];
    notifyCc: string[];
    gymId: string;
  }) {
    const allIds = [...params.notifyTo, ...params.notifyCc];
    const recipients = await this.tenant.client.staff.findMany({
      where: { id: { in: allIds } },
      select: { id: true, full_name: true, email: true, user_id: true },
    });

    const leaveTypeLabel = params.leaveType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const isTo = (id: string) => params.notifyTo.includes(id);

    // 1. Create in-app notifications
    for (const recipient of recipients) {
      if (!recipient.user_id) continue;
      try {
        await this.tenant.client.notification.create({
          data: {
            gym_id: params.gymId,
            user_id: recipient.user_id,
            type: 'leave_request',
            title: `Leave Request from ${params.staffName}`,
            message: `${params.staffName} has requested ${leaveTypeLabel} from ${params.startDate} to ${params.endDate}.${params.reason ? ` Reason: ${params.reason}` : ''}`,
            data: {
              leave_id: params.leaveRequest.id,
              staff_name: params.staffName,
              leave_type: params.leaveType,
              start_date: params.startDate,
              end_date: params.endDate,
              recipient_type: isTo(recipient.id) ? 'to' : 'cc',
            },
            related_entity_id: params.leaveRequest.id,
            related_entity_type: 'leave_request',
          },
        });
      } catch (err) {
        this.logger.warn(`In-app notification failed for ${recipient.id}: ${(err as Error).message}`);
      }
    }

    // 2. Send emails (centralized provider seam)
    const toEmails = recipients.filter((r) => isTo(r.id) && r.email).map((r) => r.email!);
    const ccEmails = recipients.filter((r) => !isTo(r.id) && r.email).map((r) => r.email!);

    if (toEmails.length === 0 && ccEmails.length === 0) return;

    const subject = `Leave Request: ${params.staffName} — ${leaveTypeLabel}`;
    const html = `
      <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0D1B2A; margin-bottom: 8px;">Leave Request</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #5A7A9A; width: 120px;">Staff</td><td style="padding: 8px 0; color: #0D1B2A; font-weight: 600;">${params.staffName}</td></tr>
          <tr><td style="padding: 8px 0; color: #5A7A9A;">Type</td><td style="padding: 8px 0; color: #0D1B2A;">${leaveTypeLabel}</td></tr>
          <tr><td style="padding: 8px 0; color: #5A7A9A;">From</td><td style="padding: 8px 0; color: #0D1B2A;">${params.startDate}</td></tr>
          <tr><td style="padding: 8px 0; color: #5A7A9A;">To</td><td style="padding: 8px 0; color: #0D1B2A;">${params.endDate}</td></tr>
          ${params.reason ? `<tr><td style="padding: 8px 0; color: #5A7A9A;">Reason</td><td style="padding: 8px 0; color: #0D1B2A;">${params.reason}</td></tr>` : ''}
        </table>
        <p style="color: #5A7A9A; font-size: 14px;">Please review and approve or reject this request in your dashboard.</p>
        <p style="color: #B0C8E0; font-size: 12px; margin-top: 24px;">This is an automated notification from MuscleX.</p>
      </div>
    `;

    try {
      const result = await this.emailService.sendRaw({
        to: toEmails.length > 0 ? toEmails : ccEmails,
        cc: toEmails.length > 0 && ccEmails.length > 0 ? ccEmails : undefined,
        subject,
        html,
      });
      if (result.delivered) {
        this.logger.log(`Leave notification email sent to: ${[...toEmails, ...ccEmails].join(', ')}`);
      } else {
        this.logger.warn('Leave notification email not delivered (no provider configured or send failed)');
      }
    } catch (err) {
      this.logger.warn(`Leave notification email failed: ${(err as Error).message}`);
    }
  }

  async getLeaveRequests(filters: {
    staff_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    branch_id?: string;
    page?: number;
    limit?: number;
  }) {
    const { staff_id, status, start_date, end_date, branch_id, page = 1, limit = 50 } = filters;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;
    const where: any = {};

    if (staff_id) where.staff_id = staff_id;
    if (status) where.status = status;
    if (start_date || end_date) {
      where.start_date = {};
      if (start_date) where.start_date.gte = new Date(start_date);
      if (end_date) where.start_date.lte = new Date(end_date);
    }
    // Filter by branch: find staff assigned to this branch
    if (branch_id) {
      where.staff = { branch_ids: { has: branch_id } };
    }

    const [data, total] = await Promise.all([
      this.tenant.client.leaveRequest.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
        include: {
          staff: { select: { id: true, full_name: true, employee_code: true, role: true } },
          reviewer: { select: { id: true, full_name: true } },
        },
      }),
      this.tenant.client.leaveRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async reviewLeaveRequest(id: string, reviewerId: string, dto: ReviewLeaveRequestDto) {
    const request = await this.tenant.client.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be reviewed');
    }

    const updated = await this.tenant.client.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        reviewer_notes: dto.reviewer_notes,
      },
      include: {
        staff: { select: { id: true, full_name: true, user_id: true, email: true } },
        reviewer: { select: { id: true, full_name: true } },
      },
    });

    // Notify the staff member about the review decision
    if (updated.staff?.user_id) {
      const statusLabel = dto.status === 'approved' ? 'Approved' : 'Rejected';
      try {
        await this.tenant.client.notification.create({
          data: {
            gym_id: request.gym_id,
            user_id: updated.staff.user_id,
            type: 'leave_reviewed',
            title: `Leave Request ${statusLabel}`,
            message: `Your ${request.leave_type.replace(/_/g, ' ')} leave request has been ${dto.status} by ${updated.reviewer?.full_name || 'a manager'}.${dto.reviewer_notes ? ` Note: ${dto.reviewer_notes}` : ''}`,
            data: {
              leave_id: id,
              status: dto.status,
              reviewer_name: updated.reviewer?.full_name,
            },
            related_entity_id: id,
            related_entity_type: 'leave_request',
          },
        });
      } catch (err) {
        this.logger.warn(`Leave review notification failed: ${(err as Error).message}`);
      }
    }

    return updated;
  }

  async cancelLeaveRequest(id: string, staffId: string) {
    const request = await this.tenant.client.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.staff_id !== staffId) {
      throw new BadRequestException('Can only cancel your own leave requests');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    return this.tenant.client.leaveRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }
}
