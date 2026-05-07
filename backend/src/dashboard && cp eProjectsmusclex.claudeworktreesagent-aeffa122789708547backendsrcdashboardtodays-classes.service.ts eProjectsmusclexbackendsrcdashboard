import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';

/**
 * OccupancyService — computes "currently in gym" by counting check-ins
 * since today's open. Since the schema does not (yet) include a
 * `checked_out_at` field, we apply a heuristic: any check-in older than
 * AUTO_CHECKOUT_HOURS is treated as having checked out.
 *
 * Pure read — no schema migration.
 */
@Injectable()
export class OccupancyService {
  /** Heuristic: check-ins older than this are auto-considered checked out */
  private static readonly AUTO_CHECKOUT_HOURS = 4;

  constructor(private prisma: PrismaService) {}

  private getBranchScope(user?: JwtPayload, branchId?: string) {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  /** Start of today in the server's local time. */
  private getTodayOpen(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /** The cutoff after which a check-in is no longer considered "in gym" */
  private getOpenCheckInCutoff(): Date {
    return new Date(
      Date.now() - OccupancyService.AUTO_CHECKOUT_HOURS * 60 * 60 * 1000,
    );
  }

  /**
   * @returns Live occupancy snapshot. Optional `branchId` overrides JWT scope.
   */
  async getOccupancy(
    user?: JwtPayload,
    branchId?: string,
  ): Promise<{
    current: number;
    peak_today: number;
    capacity?: number;
    last_check_in_at: string | null;
    as_of: string;
  }> {
    const todayOpen = this.getTodayOpen();
    const openCutoff = this.getOpenCheckInCutoff();
    const branchScope = this.getBranchScope(user, branchId);

    const [current, peakToday, lastCheckIn, capacity] = await Promise.all([
      // Currently in gym: successful check-ins since heuristic cutoff
      this.prisma.checkIn.count({
        where: {
          status: 'success',
          checked_in_at: { gte: openCutoff },
          ...branchScope,
        },
      }),

      // Peak today: total successful check-ins since today's open
      this.prisma.checkIn.count({
        where: {
          status: 'success',
          checked_in_at: { gte: todayOpen },
          ...branchScope,
        },
      }),

      // Most recent check-in for freshness display
      this.prisma.checkIn.findFirst({
        where: {
          status: 'success',
          ...branchScope,
        },
        orderBy: { checked_in_at: 'desc' },
        select: { checked_in_at: true },
      }),

      // Branch capacity if a single branch is targeted
      this.resolveCapacity(branchScope),
    ]);

    return {
      current,
      peak_today: peakToday,
      capacity: capacity ?? undefined,
      last_check_in_at: lastCheckIn?.checked_in_at
        ? new Date(lastCheckIn.checked_in_at).toISOString()
        : null,
      as_of: new Date().toISOString(),
    };
  }

  /**
   * Returns the latest 5 open check-ins (used for KPI inspector "show your work").
   */
  async getOpenCheckInsSample(user?: JwtPayload, branchId?: string) {
    const openCutoff = this.getOpenCheckInCutoff();
    const branchScope = this.getBranchScope(user, branchId);

    return this.prisma.checkIn.findMany({
      where: {
        status: 'success',
        checked_in_at: { gte: openCutoff },
        ...branchScope,
      },
      include: {
        member: { select: { id: true, full_name: true, member_code: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { checked_in_at: 'desc' },
      take: 5,
    });
  }

  /**
   * Resolves branch capacity by summing studio room capacities for the
   * targeted branch(es). Returns null if branchScope is empty (all branches).
   */
  private async resolveCapacity(branchScope: {
    branch_id?: string | { in: string[] };
  }): Promise<number | null> {
    const branchFilter = branchScope.branch_id;
    if (!branchFilter) return null;

    try {
      const rooms = await this.prisma.studioRoom.findMany({
        where: {
          is_active: true,
          ...(typeof branchFilter === 'string'
            ? { branch_id: branchFilter }
            : { branch_id: branchFilter }),
        },
        select: { capacity: true },
      });
      if (!rooms.length) return null;
      return rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
    } catch {
      return null;
    }
  }
}
