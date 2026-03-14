import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookClassDto, CancelBookingDto } from './dto';

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async bookClass(dto: BookClassDto) {
    const session = await this.prisma.classSession.findUnique({ where: { id: dto.session_id } });
    if (!session) throw new NotFoundException('Class session not found');
    if (session.status === 'cancelled') throw new BadRequestException('Cannot book a cancelled session');
    if (session.status === 'completed') throw new BadRequestException('Cannot book a completed session');

    // Check already booked
    const existingBooking = await this.prisma.classBooking.findUnique({
      where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
    });
    if (existingBooking && existingBooking.booking_status === 'booked') {
      throw new ConflictException('Member is already booked for this session');
    }

    // Check on waitlist
    const existingWaitlist = await this.prisma.classWaitlist.findUnique({
      where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
    });
    if (existingWaitlist) {
      throw new ConflictException('Member is already on the waitlist for this session');
    }

    // If capacity available → book, otherwise → waitlist
    if (session.enrolled_count < session.capacity) {
      const booking = await this.prisma.classBooking.upsert({
        where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
        create: {
          session_id: dto.session_id,
          member_id: dto.member_id,
          booking_status: 'booked',
        },
        update: {
          booking_status: 'booked',
          cancelled_at: null,
          cancellation_reason: null,
        },
        include: {
          session: { select: { id: true, name: true, start_time: true } },
          member: { select: { id: true, full_name: true, member_code: true } },
        },
      });

      await this.prisma.classSession.update({
        where: { id: dto.session_id },
        data: { enrolled_count: { increment: 1 } },
      });

      // Auto-create attendance record
      await this.prisma.classAttendance.upsert({
        where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
        create: {
          session_id: dto.session_id,
          member_id: dto.member_id,
          attendance_status: 'registered',
        },
        update: { attendance_status: 'registered' },
      });

      return { status: 'booked', booking };
    }

    // Add to waitlist
    const maxPosition = await this.prisma.classWaitlist.aggregate({
      where: { session_id: dto.session_id },
      _max: { position: true },
    });

    const waitlistEntry = await this.prisma.classWaitlist.create({
      data: {
        session_id: dto.session_id,
        member_id: dto.member_id,
        position: (maxPosition._max.position ?? 0) + 1,
      },
      include: {
        session: { select: { id: true, name: true, start_time: true } },
        member: { select: { id: true, full_name: true } },
      },
    });

    await this.prisma.classSession.update({
      where: { id: dto.session_id },
      data: { waitlist_count: { increment: 1 } },
    });

    return { status: 'waitlisted', position: waitlistEntry.position, waitlistEntry };
  }

  async cancelBooking(bookingId: string, dto?: CancelBookingDto) {
    const booking = await this.prisma.classBooking.findUnique({
      where: { id: bookingId },
      include: { session: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.booking_status === 'cancelled') throw new BadRequestException('Booking is already cancelled');

    // Cancel the booking
    await this.prisma.classBooking.update({
      where: { id: bookingId },
      data: {
        booking_status: 'cancelled',
        cancelled_at: new Date(),
        cancellation_reason: dto?.reason,
      },
    });

    await this.prisma.classSession.update({
      where: { id: booking.session_id },
      data: { enrolled_count: { decrement: 1 } },
    });

    // Update attendance record
    await this.prisma.classAttendance.updateMany({
      where: {
        session_id: booking.session_id,
        member_id: booking.member_id,
        attendance_status: 'registered',
      },
      data: { attendance_status: 'cancelled' },
    });

    // Auto-promote from waitlist
    const promoted = await this.promoteFromWaitlist(booking.session_id);

    return { cancelled: true, promoted };
  }

  async promoteFromWaitlist(sessionId: string) {
    const nextInLine = await this.prisma.classWaitlist.findFirst({
      where: { session_id: sessionId },
      orderBy: { position: 'asc' },
    });

    if (!nextInLine) return null;

    // Create/update booking for promoted member
    const booking = await this.prisma.classBooking.upsert({
      where: { session_id_member_id: { session_id: sessionId, member_id: nextInLine.member_id } },
      create: {
        session_id: sessionId,
        member_id: nextInLine.member_id,
        booking_status: 'booked',
      },
      update: {
        booking_status: 'booked',
        cancelled_at: null,
        cancellation_reason: null,
      },
      include: {
        member: { select: { id: true, full_name: true, member_code: true } },
      },
    });

    // Update counters
    await this.prisma.classSession.update({
      where: { id: sessionId },
      data: {
        enrolled_count: { increment: 1 },
        waitlist_count: { decrement: 1 },
      },
    });

    // Remove from waitlist
    await this.prisma.classWaitlist.delete({ where: { id: nextInLine.id } });

    // Re-number remaining waitlist positions
    const remaining = await this.prisma.classWaitlist.findMany({
      where: { session_id: sessionId },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.classWaitlist.update({
        where: { id: remaining[i].id },
        data: { position: i + 1 },
      });
    }

    // Create attendance record for promoted member
    await this.prisma.classAttendance.upsert({
      where: { session_id_member_id: { session_id: sessionId, member_id: nextInLine.member_id } },
      create: {
        session_id: sessionId,
        member_id: nextInLine.member_id,
        attendance_status: 'registered',
      },
      update: { attendance_status: 'registered' },
    });

    return { member_id: nextInLine.member_id, booking };
  }

  async getSessionBookings(sessionId: string) {
    const session = await this.prisma.classSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Class session not found');

    const [bookings, waitlist] = await Promise.all([
      this.prisma.classBooking.findMany({
        where: { session_id: sessionId, booking_status: 'booked' },
        include: {
          member: { select: { id: true, full_name: true, member_code: true, profile_photo_url: true, phone: true } },
        },
        orderBy: { booked_at: 'asc' },
      }),
      this.prisma.classWaitlist.findMany({
        where: { session_id: sessionId },
        include: {
          member: { select: { id: true, full_name: true, member_code: true, phone: true } },
        },
        orderBy: { position: 'asc' },
      }),
    ]);

    return {
      session_id: sessionId,
      capacity: session.capacity,
      enrolled_count: session.enrolled_count,
      waitlist_count: session.waitlist_count,
      bookings,
      waitlist,
    };
  }

  async getMemberBookings(memberId: string, filters?: { status?: string; upcoming?: boolean }) {
    const where: any = { member_id: memberId };
    if (filters?.status) where.booking_status = filters.status;

    if (filters?.upcoming) {
      where.session = { start_time: { gte: new Date() } };
    }

    return this.prisma.classBooking.findMany({
      where,
      include: {
        session: {
          select: {
            id: true, name: true, category: true, start_time: true, end_time: true,
            status: true,
            trainer: { select: { id: true, full_name: true } },
            studio: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { booked_at: 'desc' },
    });
  }

  async getWaitlistPosition(sessionId: string, memberId: string) {
    const entry = await this.prisma.classWaitlist.findUnique({
      where: { session_id_member_id: { session_id: sessionId, member_id: memberId } },
    });
    if (!entry) return null;
    return { position: entry.position, joined_at: entry.joined_at };
  }

  async removeFromWaitlist(sessionId: string, memberId: string) {
    const entry = await this.prisma.classWaitlist.findUnique({
      where: { session_id_member_id: { session_id: sessionId, member_id: memberId } },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    await this.prisma.classWaitlist.delete({ where: { id: entry.id } });

    await this.prisma.classSession.update({
      where: { id: sessionId },
      data: { waitlist_count: { decrement: 1 } },
    });

    // Re-number positions
    const remaining = await this.prisma.classWaitlist.findMany({
      where: { session_id: sessionId },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await this.prisma.classWaitlist.update({
        where: { id: remaining[i].id },
        data: { position: i + 1 },
      });
    }

    return { removed: true };
  }
}
