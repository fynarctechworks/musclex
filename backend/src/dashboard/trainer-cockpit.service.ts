import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

/**
 * Per-trainer cockpit data — sessions today, attendance stats, my client
 * portfolio. All queries scope to the trainer's `staff_id` (looked up via
 * the JWT user_id). Returns an empty cockpit if no Staff row exists.
 */
@Injectable()
export class TrainerCockpitService {
  private readonly logger = new Logger(TrainerCockpitService.name);
  constructor(private readonly tenant: TenantPrisma) {}

  async getCockpit(user: JwtPayload | undefined) {
    const staffId = await this.lookupStaffId(user);
    if (!staffId) {
      return {
        staff_id: null,
        sessions_today: [],
        next_session: null,
        sessions_today_count: 0,
        clients_count: 0,
        attendance_rate_30d: null,
        retention_rate_60d: null,
        no_shows_30d: 0,
        upcoming_sessions: [],
        my_clients_at_risk: 0,
      };
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    const [
      sessionsToday,
      upcoming,
      attendance30d,
      noShows30d,
      clientIdsAttendances,
    ] = await Promise.all([
      this.tenant.client.classSession.findMany({
        where: {
          trainer_id: staffId,
          start_time: { gte: startOfToday, lt: endOfToday },
        },
        select: {
          id: true,
          name: true,
          start_time: true,
          end_time: true,
          capacity: true,
          enrolled_count: true,
          status: true,
        },
        orderBy: { start_time: 'asc' },
      }),
      this.tenant.client.classSession.findMany({
        where: {
          trainer_id: staffId,
          start_time: { gte: now, lte: sevenDaysFromNow },
        },
        select: {
          id: true,
          name: true,
          start_time: true,
          enrolled_count: true,
          capacity: true,
        },
        orderBy: { start_time: 'asc' },
        take: 10,
      }),
      this.tenant.client.classAttendance.findMany({
        where: {
          session: {
            trainer_id: staffId,
            start_time: { gte: thirtyDaysAgo, lt: now },
          },
        },
        select: { attendance_status: true },
      }),
      this.tenant.client.classAttendance.count({
        where: {
          session: {
            trainer_id: staffId,
            start_time: { gte: thirtyDaysAgo, lt: now },
          },
          attendance_status: 'no_show',
        },
      }),
      this.tenant.client.classAttendance.findMany({
        where: {
          session: {
            trainer_id: staffId,
            start_time: { gte: sixtyDaysAgo },
          },
        },
        select: { member_id: true },
        take: 1000,
      }),
    ]);

    const clientIds = Array.from(
      new Set(clientIdsAttendances.map((a) => a.member_id).filter(Boolean)),
    );

    // Attendance rate = (present + late) / (registered + present + late + no_show)
    const present = attendance30d.filter(
      (a) => a.attendance_status === 'present' || a.attendance_status === 'late',
    ).length;
    const total = attendance30d.length;
    const attendanceRate =
      total > 0 ? Math.round((present / total) * 1000) / 10 : null;

    // At-risk clients: any of the trainer's clients with a membership
    // expiring in the next 7 days.
    let atRiskCount = 0;
    if (clientIds.length > 0) {
      atRiskCount = await this.tenant.client.memberMembership.count({
        where: {
          status: 'active',
          member_id: { in: clientIds },
          end_date: { gte: now, lte: sevenDaysFromNow },
        },
      });
    }

    const nextSession = sessionsToday.find(
      (s) => s.start_time && new Date(s.start_time) >= now,
    );

    return {
      staff_id: staffId,
      sessions_today: sessionsToday,
      sessions_today_count: sessionsToday.length,
      next_session: nextSession ?? null,
      clients_count: clientIds.length,
      attendance_rate_30d: attendanceRate,
      retention_rate_60d: null, // computed in a follow-on; needs cohort logic
      no_shows_30d: noShows30d,
      upcoming_sessions: upcoming,
      my_clients_at_risk: atRiskCount,
    };
  }

  private async lookupStaffId(
    user: JwtPayload | undefined,
  ): Promise<string | null> {
    if (!user?.user_id) return null;
    try {
      const row = await this.tenant.client.staff.findFirst({
        where: { user_id: user.user_id, is_active: true },
        select: { id: true },
      });
      return row?.id ?? null;
    } catch (err) {
      this.logger.warn(
        `lookupStaffId failed: ${(err as Error)?.message ?? err}`,
      );
      return null;
    }
  }
}
