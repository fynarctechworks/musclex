import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { BookClassDto, CancelBookingDto } from './dto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class BookingService {
  constructor(private tenant: TenantPrisma) {}

  async bookClass(dto: BookClassDto) {
    const session = await this.tenant.client.classSession.findUnique({ where: { id: dto.session_id } });
    if (!session) throw new NotFoundException('Class session not found');
    if (session.status === 'cancelled') throw new BadRequestException('Cannot book a cancelled session');
    if (session.status === 'completed') throw new BadRequestException('Cannot book a completed session');

    // ── ATOMIC booking inside a transaction to prevent overbooking ──
    return this.tenant.client.$transaction(async (tx) => {
      // Re-fetch session inside transaction for consistent read
      const lockedSession = await tx.classSession.findUnique({ where: { id: dto.session_id } });
      if (!lockedSession) throw new NotFoundException('Class session not found');

      // Check already booked
      const existingBooking = await tx.classBooking.findUnique({
        where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
      });
      if (existingBooking && existingBooking.booking_status === 'booked') {
        throw new ConflictException('Member is already booked for this session');
      }

      // Check on waitlist
      const existingWaitlist = await tx.classWaitlist.findUnique({
        where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
      });
      if (existingWaitlist) {
        throw new ConflictException('Member is already on the waitlist for this session');
      }

      // Capacity check INSIDE transaction — prevents race condition
      if (lockedSession.enrolled_count < lockedSession.capacity) {
        const booking = await tx.classBooking.upsert({
          where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
          create: {
            gym_id: getTenantGymId()!,
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

        await tx.classSession.update({
          where: { id: dto.session_id },
          data: { enrolled_count: { increment: 1 } },
        });

        // Auto-create attendance record
        await tx.classAttendance.upsert({
          where: { session_id_member_id: { session_id: dto.session_id, member_id: dto.member_id } },
          create: {
            gym_id: getTenantGymId()!,
            session_id: dto.session_id,
            member_id: dto.member_id,
            attendance_status: 'registered',
          },
          update: { attendance_status: 'registered' },
        });

        return { status: 'booked', booking };
      }

      // ── Waitlist (also atomic inside same transaction) ──
      const maxPosition = await tx.classWaitlist.aggregate({
        where: { session_id: dto.session_id },
        _max: { position: true },
      });

      const waitlistEntry = await tx.classWaitlist.create({
        data: {
          gym_id: getTenantGymId()!,
          session_id: dto.session_id,
          member_id: dto.member_id,
          position: (maxPosition._max.position ?? 0) + 1,
        },
        include: {
          session: { select: { id: true, name: true, start_time: true } },
          member: { select: { id: true, full_name: true } },
        },
      });

      await tx.classSession.update({
        where: { id: dto.session_id },
        data: { waitlist_count: { increment: 1 } },
      });

      return { status: 'waitlisted', position: waitlistEntry.position, waitlistEntry };
    });
  }

  async cancelBooking(bookingId: string, dto?: CancelBookingDto) {
    const booking = await this.tenant.client.classBooking.findUnique({
      where: { id: bookingId },
      include: { session: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.booking_status === 'cancelled') throw new BadRequestException('Booking is already cancelled');

    // Wrap cancellation + promotion in a transaction
    return this.tenant.client.$transaction(async (tx) => {
      await tx.classBooking.update({
        where: { id: bookingId },
        data: {
          booking_status: 'cancelled',
          cancelled_at: new Date(),
          cancellation_reason: dto?.reason,
        },
      });

      await tx.classSession.update({
        where: { id: booking.session_id },
        data: { enrolled_count: { decrement: 1 } },
      });

      await tx.classAttendance.updateMany({
        where: {
          session_id: booking.session_id,
          member_id: booking.member_id,
          attendance_status: 'registered',
        },
        data: { attendance_status: 'cancelled' },
      });

      // Auto-promote from waitlist (inside same transaction)
      const promoted = await this._promoteFromWaitlistTx(tx, booking.session_id);

      return { cancelled: true, promoted };
    });
  }

  /** Promote next waitlisted member — must be called inside a transaction */
  private async _promoteFromWaitlistTx(tx: any, sessionId: string) {
    const nextInLine = await tx.classWaitlist.findFirst({
      where: { session_id: sessionId },
      orderBy: { position: 'asc' },
    });

    if (!nextInLine) return null;

    const booking = await tx.classBooking.upsert({
      where: { session_id_member_id: { session_id: sessionId, member_id: nextInLine.member_id } },
      create: {
        gym_id: getTenantGymId()!,
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

    await tx.classSession.update({
      where: { id: sessionId },
      data: {
        enrolled_count: { increment: 1 },
        waitlist_count: { decrement: 1 },
      },
    });

    await tx.classWaitlist.delete({ where: { id: nextInLine.id } });

    // Re-number remaining waitlist positions
    const remaining = await tx.classWaitlist.findMany({
      where: { session_id: sessionId },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      await tx.classWaitlist.update({
        where: { id: remaining[i].id },
        data: { position: i + 1 },
      });
    }

    await tx.classAttendance.upsert({
      where: { session_id_member_id: { session_id: sessionId, member_id: nextInLine.member_id } },
      create: {
        gym_id: getTenantGymId()!,
        session_id: sessionId,
        member_id: nextInLine.member_id,
        attendance_status: 'registered',
      },
      update: { attendance_status: 'registered' },
    });

    return { member_id: nextInLine.member_id, booking };
  }

  /** Public wrapper for standalone waitlist promotion */
  async promoteFromWaitlist(sessionId: string) {
    return this.tenant.client.$transaction(async (tx) => {
      return this._promoteFromWaitlistTx(tx, sessionId);
    });
  }

  async getSessionBookings(sessionId: string) {
    const session = await this.tenant.client.classSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Class session not found');

    const [bookings, waitlist] = await Promise.all([
      this.tenant.client.classBooking.findMany({
        where: { session_id: sessionId, booking_status: 'booked' },
        include: {
          member: { select: { id: true, full_name: true, member_code: true, profile_photo_url: true, phone: true } },
        },
        orderBy: { booked_at: 'asc' },
      }),
      this.tenant.client.classWaitlist.findMany({
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

    return this.tenant.client.classBooking.findMany({
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
    const entry = await this.tenant.client.classWaitlist.findUnique({
      where: { session_id_member_id: { session_id: sessionId, member_id: memberId } },
    });
    if (!entry) return null;
    return { position: entry.position, joined_at: entry.joined_at };
  }

  async removeFromWaitlist(sessionId: string, memberId: string) {
    return this.tenant.client.$transaction(async (tx) => {
      const entry = await tx.classWaitlist.findUnique({
        where: { session_id_member_id: { session_id: sessionId, member_id: memberId } },
      });
      if (!entry) throw new NotFoundException('Waitlist entry not found');

      await tx.classWaitlist.delete({ where: { id: entry.id } });

      await tx.classSession.update({
        where: { id: sessionId },
        data: { waitlist_count: { decrement: 1 } },
      });

      // Re-number positions
      const remaining = await tx.classWaitlist.findMany({
        where: { session_id: sessionId },
        orderBy: { position: 'asc' },
      });
      for (let i = 0; i < remaining.length; i++) {
        await tx.classWaitlist.update({
          where: { id: remaining[i].id },
          data: { position: i + 1 },
        });
      }

      return { removed: true };
    });
  }
}
