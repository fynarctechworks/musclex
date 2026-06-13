import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { ClassesService } from '../../classes/classes.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import type {
  ClassListData,
  ClassListItemData,
  ClassBookingResultData,
  ClassCancelResultData,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER CLASS SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Member-facing browse + self-book + cancel over the legacy Class/
 * ClassEnrollment tables the admin Schedule writes — so what gym staff create
 * appears in the member app, and a member booking shows up on the same admin
 * Schedule. Booking/cancel REUSE the admin ClassesService so capacity, waitlist
 * and duplicate rules are enforced identically to the front-desk path (we do
 * NOT reinvent enrollment business logic — mirrors how check-in reuses the
 * CheckInOrchestrator).
 *
 * Scoping: gym_id is auto-injected by the tenant-scoped Prisma client; we also
 * pin the member's own branch_id and never accept an id from the client (the
 * member is always @CurrentMember). Other members' identities are never
 * returned — only aggregate seat counts and THIS member's own booking state.
 */
@Injectable()
export class MemberClassService {
  /** Cap the upcoming-class window so a busy branch can't return unbounded rows. */
  private readonly maxClasses = 50;

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly classes: ClassesService,
  ) {}

  /** Upcoming, non-cancelled classes at the member's branch, soonest first. */
  async listUpcoming(member: CurrentMemberContext): Promise<ClassListData> {
    const branchId = await this.memberBranchId(member);

    const rows = await this.tenant.client.class.findMany({
      where: {
        branch_id: branchId,
        status: { not: 'cancelled' },
        starts_at: { gte: new Date() },
      },
      orderBy: { starts_at: 'asc' },
      take: this.maxClasses,
      select: {
        id: true,
        name: true,
        category: true,
        starts_at: true,
        duration_minutes: true,
        room: true,
        capacity: true,
        trainer: { select: { full_name: true } },
      },
    });
    if (rows.length === 0) return { classes: [] };

    const classIds = rows.map((c) => c.id);

    // One round-trip for active bookings across the listed classes. We read
    // member_id only to find THIS member's booking — it is never returned.
    const bookings = await this.tenant.client.classEnrollment.findMany({
      where: {
        class_id: { in: classIds },
        status: { in: ['enrolled', 'waitlisted'] },
      },
      select: {
        class_id: true,
        member_id: true,
        status: true,
        waitlist_position: true,
      },
    });

    const enrolledCount = new Map<string, number>();
    const mine = new Map<
      string,
      { status: string; waitlist_position: number | null }
    >();
    for (const b of bookings) {
      if (b.status === 'enrolled') {
        enrolledCount.set(b.class_id, (enrolledCount.get(b.class_id) ?? 0) + 1);
      }
      if (b.member_id === member.memberId) {
        mine.set(b.class_id, {
          status: b.status,
          waitlist_position: b.waitlist_position,
        });
      }
    }

    const classes: ClassListItemData[] = rows.map((c) => {
      const enrolled = enrolledCount.get(c.id) ?? 0;
      const own = mine.get(c.id);
      return {
        id: c.id,
        title: c.name,
        category: c.category,
        startsAt: c.starts_at.toISOString(),
        durationMinutes: c.duration_minutes,
        room: c.room ?? null,
        trainerName: c.trainer?.full_name ?? null,
        capacity: c.capacity,
        seatsLeft: Math.max(0, c.capacity - enrolled),
        booked: !!own,
        bookingStatus: (own?.status as 'enrolled' | 'waitlisted') ?? null,
        waitlistPosition: own?.waitlist_position ?? null,
      };
    });

    return { classes };
  }

  /**
   * Book the current member into a class. Validates the class is one the member
   * may actually see (their branch, future, not cancelled) BEFORE delegating to
   * the shared enrollment logic, so a crafted classId can't book into another
   * branch's or a past/cancelled class.
   */
  async book(
    member: CurrentMemberContext,
    classId: string,
  ): Promise<ClassBookingResultData> {
    const branchId = await this.memberBranchId(member);

    const cls = await this.tenant.client.class.findFirst({
      where: { id: classId },
      select: { branch_id: true, status: true, starts_at: true, capacity: true },
    });
    // Hide cross-branch/non-existent classes behind the same not-found response.
    if (!cls || cls.branch_id !== branchId) {
      throw MemberException.notFound('Class not found.');
    }
    if (cls.status === 'cancelled') {
      throw MemberException.conflict('This class has been cancelled.');
    }
    if (cls.starts_at.getTime() <= Date.now()) {
      throw MemberException.conflict('This class has already started.');
    }

    // Reuse the front-desk enrollment path (capacity → enrol or waitlist,
    // duplicate guard, atomic transaction). It throws BadRequest when the
    // member is already booked → surfaced as a 400 by the exception filter.
    const result = (await this.classes.enroll(
      member.tenantId,
      classId,
      member.memberId,
    )) as {
      status: 'enrolled' | 'waitlisted';
      waitlist_position: number | null;
      message?: string;
    };

    const enrolled = await this.tenant.client.classEnrollment.count({
      where: { class_id: classId, status: 'enrolled' },
    });

    return {
      classId,
      status: result.status,
      waitlistPosition: result.waitlist_position ?? null,
      seatsLeft: Math.max(0, cls.capacity - enrolled),
      message: result.message ?? 'Booked.',
    };
  }

  /** Cancel the current member's booking (auto-promotes the next waitlister). */
  async cancel(
    member: CurrentMemberContext,
    classId: string,
  ): Promise<ClassCancelResultData> {
    const result = (await this.classes.cancelEnrollment(
      member.tenantId,
      classId,
      member.memberId,
    )) as {
      cancelled: boolean;
      promoted: { member_name: string } | null;
    };

    return {
      cancelled: result.cancelled,
      promotedMemberName: result.promoted?.member_name ?? null,
    };
  }

  // ── helpers ────────────────────────────────────────────────────

  /** The authenticated member's branch (never trusted from the client). */
  private async memberBranchId(member: CurrentMemberContext): Promise<string> {
    const m = await this.tenant.client.member.findFirst({
      where: { id: member.memberId },
      select: { branch_id: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');
    return m.branch_id;
  }
}
