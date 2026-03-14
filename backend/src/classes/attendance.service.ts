import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async markAttendance(sessionId: string, dto: MarkAttendanceDto) {
    const session = await this.prisma.classSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Class session not found');

    // Verify member has a booking
    const booking = await this.prisma.classBooking.findUnique({
      where: {
        session_id_member_id: { session_id: sessionId, member_id: dto.member_id },
      },
    });
    if (!booking || booking.booking_status !== 'booked') {
      throw new BadRequestException('Member does not have an active booking for this session');
    }

    const attendance = await this.prisma.classAttendance.upsert({
      where: {
        session_id_member_id: { session_id: sessionId, member_id: dto.member_id },
      },
      create: {
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
      await this.prisma.classBooking.update({
        where: { session_id_member_id: { session_id: sessionId, member_id: dto.member_id } },
        data: { attended: true },
      });
    }

    return attendance;
  }

  async bulkMarkAttendance(sessionId: string, entries: MarkAttendanceDto[]) {
    const results = [];
    for (const entry of entries) {
      try {
        const result = await this.markAttendance(sessionId, entry);
        results.push({ member_id: entry.member_id, success: true, result });
      } catch (error) {
        results.push({ member_id: entry.member_id, success: false, error: error.message });
      }
    }
    return results;
  }

  async getSessionAttendance(sessionId: string) {
    const session = await this.prisma.classSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Class session not found');

    const attendance = await this.prisma.classAttendance.findMany({
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
    memberId: string,
    filters?: { date_from?: string; date_to?: string; category?: string },
  ) {
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

    const records = await this.prisma.classAttendance.findMany({
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

  async completeSession(sessionId: string) {
    const session = await this.prisma.classSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Class session not found');
    if (session.status === 'completed') throw new BadRequestException('Session is already completed');
    if (session.status === 'cancelled') throw new BadRequestException('Cannot complete a cancelled session');

    // Mark remaining "registered" attendance as no_show
    await this.prisma.classAttendance.updateMany({
      where: { session_id: sessionId, attendance_status: 'registered' },
      data: { attendance_status: 'no_show' },
    });

    // Update session status
    await this.prisma.classSession.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });

    // Clear any remaining waitlist
    const removedFromWaitlist = await this.prisma.classWaitlist.deleteMany({
      where: { session_id: sessionId },
    });

    if (removedFromWaitlist.count > 0) {
      await this.prisma.classSession.update({
        where: { id: sessionId },
        data: { waitlist_count: 0 },
      });
    }

    return this.getSessionAttendance(sessionId);
  }
}
