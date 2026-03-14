import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { CreateStaffShiftDto, UpdateStaffShiftDto } from './dto/create-staff-shift.dto';
import { CreateLeaveRequestDto, ReviewLeaveRequestDto } from './dto/leave-request.dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  private stripSalary(staff: any, userRole: string): any {
    if (userRole === 'owner') return staff;
    const { salary, payroll_config, ...rest } = staff;
    return rest;
  }

  // ── Staff CRUD ────────────────────────────────────────────────

  async findAll(
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
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (organization_id) where.organization_id = organization_id;

    if (branch_id) {
      where.OR = [
        { branch_id },
        { branch_ids: { has: branch_id } },
      ];
    } else if (
      user.role !== 'owner' &&
      user.role !== 'brand_owner' &&
      user.branch_ids?.length > 0
    ) {
      where.OR = user.branch_ids.flatMap((bid: string) => [
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
      this.prisma.staff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          organization: { select: { id: true, name: true } },
          primary_branch: { select: { id: true, name: true, code: true } },
          profile: true,
          _count: { select: { trainer_clients: true, trainer_sessions: true } },
        },
      }),
      this.prisma.staff.count({ where }),
    ]);

    return {
      data: data.map((s) => this.stripSalary(s, user.role)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, userRole: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
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

  async create(data: CreateStaffDto) {
    // Check employee_code uniqueness
    if (data.employee_code) {
      const existing = await this.prisma.staff.findUnique({
        where: { employee_code: data.employee_code },
      });
      if (existing) throw new ConflictException('Employee code already exists');
    }

    const staff = await this.prisma.staff.create({
      data: {
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        email: data.email,
        user_id: data.user_id,
        organization_id: data.organization_id,
        branch_id: data.branch_id,
        branch_ids: data.branch_ids || [],
        employee_code: data.employee_code,
        job_title: data.job_title,
        employment_type: data.employment_type ?? 'full_time',
        specializations: data.specializations || [],
        salary: data.salary,
        joined_at: data.joined_at ? new Date(data.joined_at) : new Date(),
      },
    });

    // Auto-create empty profile for trainers
    if (data.role === 'trainer') {
      await this.prisma.staffProfile.create({
        data: {
          staff_id: staff.id,
          specializations: data.specializations || [],
        },
      });
    }

    return this.findOne(staff.id, 'owner');
  }

  async update(id: string, data: UpdateStaffDto) {
    const existing = await this.prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Staff member not found');

    // Check employee_code uniqueness if changing
    if (data.employee_code && data.employee_code !== existing.employee_code) {
      const conflict = await this.prisma.staff.findUnique({
        where: { employee_code: data.employee_code },
      });
      if (conflict) throw new ConflictException('Employee code already exists');
    }

    const updateData: any = { ...data };
    if (data.joined_at) {
      updateData.joined_at = new Date(data.joined_at);
    }

    await this.prisma.staff.update({ where: { id }, data: updateData });
    return this.findOne(id, 'owner');
  }

  async deactivate(id: string) {
    const existing = await this.prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Staff member not found');
    return this.prisma.staff.update({
      where: { id },
      data: { is_active: false, status: 'inactive' },
    });
  }

  // ── Staff Profile ─────────────────────────────────────────────

  async getProfile(staffId: string) {
    const profile = await this.prisma.staffProfile.findUnique({
      where: { staff_id: staffId },
    });
    if (!profile) throw new NotFoundException('Staff profile not found');
    return profile;
  }

  async updateProfile(staffId: string, dto: UpdateStaffProfileDto) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.prisma.staffProfile.upsert({
      where: { staff_id: staffId },
      update: dto,
      create: {
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
    return this.prisma.staffAvailability.findMany({
      where: { staff_id: staffId },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
  }

  async setAvailability(staffId: string, slots: SetAvailabilityDto[]) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    // Replace all availability for this staff member
    await this.prisma.$transaction(async (tx) => {
      await tx.staffAvailability.deleteMany({ where: { staff_id: staffId } });
      await tx.staffAvailability.createMany({
        data: slots.map((s) => ({
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

    return this.prisma.staffAttendance.findMany({
      where,
      orderBy: { check_in_time: 'desc' },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async recordCheckIn(dto: RecordAttendanceDto) {
    const staff = await this.prisma.staff.findUnique({ where: { id: dto.staff_id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.prisma.staffAttendance.create({
      data: {
        staff_id: dto.staff_id,
        branch_id: dto.branch_id,
        check_in_time: dto.check_in_time ? new Date(dto.check_in_time) : new Date(),
        method: dto.method ?? 'manual',
        notes: dto.notes,
      },
    });
  }

  async recordCheckOut(attendanceId: string) {
    const record = await this.prisma.staffAttendance.findUnique({
      where: { id: attendanceId },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (record.check_out_time) throw new ConflictException('Already checked out');

    return this.prisma.staffAttendance.update({
      where: { id: attendanceId },
      data: { check_out_time: new Date() },
    });
  }

  // ── Staff Shifts ──────────────────────────────────────────────

  async createShift(dto: CreateStaffShiftDto) {
    const staff = await this.prisma.staff.findUnique({ where: { id: dto.staff_id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    // Check for overlapping shifts on the same date
    const existing = await this.prisma.staffShift.findFirst({
      where: {
        staff_id: dto.staff_id,
        shift_date: new Date(dto.shift_date),
        OR: [
          { start_time: { lt: dto.end_time }, end_time: { gt: dto.start_time } },
        ],
      },
    });
    if (existing) throw new ConflictException('Shift overlaps with an existing shift');

    return this.prisma.staffShift.create({
      data: {
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

    return this.prisma.staffShift.findMany({
      where,
      orderBy: [{ shift_date: 'asc' }, { start_time: 'asc' }],
      include: {
        staff: { select: { id: true, full_name: true, employee_code: true, role: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async updateShift(id: string, dto: UpdateStaffShiftDto) {
    const shift = await this.prisma.staffShift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');

    return this.prisma.staffShift.update({
      where: { id },
      data: dto,
      include: {
        staff: { select: { id: true, full_name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async deleteShift(id: string) {
    const shift = await this.prisma.staffShift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.prisma.staffShift.delete({ where: { id } });
  }

  // ── Leave Management ──────────────────────────────────────────

  async createLeaveRequest(dto: CreateLeaveRequestDto) {
    const staff = await this.prisma.staff.findUnique({ where: { id: dto.staff_id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);
    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }

    // Check for overlapping leave requests (pending or approved)
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        staff_id: dto.staff_id,
        status: { in: ['pending', 'approved'] },
        start_date: { lte: endDate },
        end_date: { gte: startDate },
      },
    });
    if (overlap) throw new ConflictException('Overlapping leave request already exists');

    return this.prisma.leaveRequest.create({
      data: {
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
  }

  async getLeaveRequests(filters: {
    staff_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const { staff_id, status, start_date, end_date, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (staff_id) where.staff_id = staff_id;
    if (status) where.status = status;
    if (start_date || end_date) {
      where.start_date = {};
      if (start_date) where.start_date.gte = new Date(start_date);
      if (end_date) where.start_date.lte = new Date(end_date);
    }

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          staff: { select: { id: true, full_name: true, employee_code: true, role: true } },
          reviewer: { select: { id: true, full_name: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async reviewLeaveRequest(id: string, reviewerId: string, dto: ReviewLeaveRequestDto) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be reviewed');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        reviewer_notes: dto.reviewer_notes,
      },
      include: {
        staff: { select: { id: true, full_name: true } },
        reviewer: { select: { id: true, full_name: true } },
      },
    });
  }

  async cancelLeaveRequest(id: string, staffId: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.staff_id !== staffId) {
      throw new BadRequestException('Can only cancel your own leave requests');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }
}
