import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { MarkAttendanceDto } from './dto';

@Injectable()
export class AttendanceService {
  constructor(private tenant: TenantPrisma) {}

  async markAttendance(studioId: string, sessionId: string, dto: MarkAttendanceDto) {
    // Get session and verify it belongs to studio
    const session = await this.tenant.client.classSession.findFirst({
      where: { id: sessionId },
      include: { branch: { select: { organization_id: true } } },
    });
    if (!session) throw new NotFoundException('Class session not found');
    if (session.branch.organization_id !== studioId) {
      throw new ForbiddenException('Access denied to this session');
    }

    // Verify member belongs to studio
    const member = await this.tenant.client.member.findFirst({
      where: { id: dto.member_id } // tenant isolation via search_path,
    });
    if (!member) throw new NotFoundException('Member not found in studio');

    // Verify member has a booking
    const booking = await this.tenant.client.classBooking.findUnique({
      where: {
        session_id_member_id: { session_id: sessionId, member_id: dto.member_id },
      },
    });
    if (!booking || booking.booking_status !== 'booked') {
      throw new BadRequestException('Member does not have an active booking for this session');
    }

    const attendance = await this.tenant.client.classAttendance.upsert({
      where: {
        session_id_member_id: { session_id: sessionId, member_id: dto.member_id },
      },
      create: {
        gym_id: getTenantGymId()!,
        session_id: sessionId,
        member_id: dto.member_id,
        attendance_status: dto.attendance_status,
        check_in_time: dto.attendance_status === 'present' || dto.attendance_status === 'late'
          ? new Date()
          : null,
      },
      update: {
        attendance_status: dto.attendance_status,
        check_in_time: dto.attendance_status === 'present' || dto.attendance_status === 'late'
          ? new Date()
          : null,
      },
      include: {
        member: { select: { id: true, full_name: true, member_code: true } },
      },
    });

    // Update booking attended flag
    if (dto.attendance_status === 'present' || dto.attendance_status === 'late') {
      await this.tenant.client.classBooking.update({
        where: { session_id_member_id: { session_id: sessionId, member_id: dto.member_id } },
        data: { attended: true },
      });
    }

    return attendance;
  }

  async bulkMarkAttendance(studioId: string, sessionId: string, entries: MarkAttendanceDto[]) {
    const results = [];
    for (const entry of entries) {
      try {
        const result = await this.markAttendance(studioId, sessionId, entry);
        results.push({ member_id: entry.member_id, success: true, result });
      } catch (error) {
        results.push({ member_id: entry.member_id, success: false, error: error.message });
      }
    }
    return results;
  }

  async getSessionAttendance(studioId: string, sessionId: string) {
    // Get session and verify it belongs to studio
    const session = await this.tenant.client.classSession.findFirst({
      where: { id: sessionId },
      include: { branch: { select: { organization_id: true } } },
    });
    if (!session) throw new NotFoundException('Class session not found');
    if (session.branch.organization_id !== studioId) {
      throw new ForbiddenException('Access denied to this session');
    }

    const attendance = await this.tenant.client.classAttendance.findMany({
      where: { session_id: sessionId },
      include: {
        member: {
          select: { id: true, full_name: true, member_code: true, profile_photo_url: true, phone: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const summary = {
      total: attendance.length,
      present: attendance.filter((a) => a.attendance_status === 'present').length,
      late: attendance.filter((a) => a.attendance_status === 'late').length,
      no_show: attendance.filter((a) => a.attendance_status === 'no_show').length,
      cancelled: attendance.filter((a) => a.attendance_status === 'cancelled').length,
      registered: attendance.filter((a) => a.attendance_status === 'registered').length,
    };

    return { session_id: sessionId, attendance, summary };
  }

  async getMemberAttendanceHistory(
    studioId: string,
    memberId: string,
    filters?: { date_from?: string; date_to?: string; category?: string },
  ) {
    // Verify member belongs to studio
    const member = await this.tenant.client.member.findFirst({
      where: { id: memberId } // tenant isolation via search_path,
    });
    if (!member) throw new NotFoundException('Member not found in studio');

    const where: any = { member_id: memberId };

    if (filters?.date_from || filters?.date_to || filters?.category) {
      where.session = {};
      if (filters?.date_from) where.session.start_time = { gte: new Date(filters.date_from) };
      if (filters?.date_to) {
        where.session.start_time = {
          ...where.session.start_time,
          lte: new Date(filters.date_to),
        };
      }
      if (filters?.category) where.session.category = filters.category;
    }

    const records = await this.tenant.client.classAttendance.findMany({
      where,
      include: {
        session: {
          select: {
            id: true, name: true, category: true, start_time: true, end_time: true,
            trainer: { select: { id: true, full_name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const totalClasses = records.length;
    const attended = records.filter((r) => r.attendance_status === 'present' || r.attendance_status === 'late').length;
    const stats = {
      total_classes: totalClasses,
      attended,
      no_shows: records.filter((r) => r.attendance_status === 'no_show').length,
      cancelled: records.filter((r) => r.attendance_status === 'cancelled').length,
      attendance_rate: totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 0,
    };

    return { records, stats };
  }

  async completeSession(studioId: string, sessionId: string) {
    // Get session and verify it belongs to studio
    const session = await this.tenant.client.classSession.findFirst({
      where: { id: sessionId },
      include: { branch: { select: { organization_id: true } } },
    });
    if (!session) throw new NotFoundException('Class session not found');
    if (session.branch.organization_id !== studioId) {
      throw new ForbiddenException('Access denied to this session');
    }

    if (session.status === 'completed') throw new BadRequestException('Session is already completed');
    if (session.status === 'cancelled') throw new BadRequestException('Cannot complete a cancelled session');

    // Mark remaining "registered" attendance as no_show
    await this.tenant.client.classAttendance.updateMany({
      where: { session_id: sessionId, attendance_status: 'registered' },
      data: { attendance_status: 'no_show' },
    });

    // Update session status
    await this.tenant.client.classSession.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });

    // Clear any remaining waitlist
    const removedFromWaitlist = await this.tenant.client.classWaitlist.deleteMany({
      where: { session_id: sessionId },
    });

    if (removedFromWaitlist.count > 0) {
      await this.tenant.client.classSession.update({
        where: { id: sessionId },
        data: { waitlist_count: 0 },
      });
    }

    return this.getSessionAttendance(studioId, sessionId);
  }
}
