import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';

/**
 * DashboardMetricsService — Materialized counter service.
 *
 * Instead of running 7+ COUNT/SUM queries per dashboard load,
 * we maintain pre-aggregated counters that update atomically
 * inside the same transaction as the source write.
 *
 * Counters are per gym_id (branch_id=null for gym-wide aggregate).
 * Branch-level breakdowns use a non-null branch_id row.
 */
@Injectable()
export class DashboardMetricsService {
  private readonly logger = new Logger(DashboardMetricsService.name);

  constructor(private tenant: TenantPrisma) {}

  // ── Ensure Row Exists (auto-create on first access) ──────────

  /**
   * Returns the gym-wide metrics row, creating it if missing.
   * Uses gym_id from tenant context.
   */
  private async ensureRow(tx: any, branchId?: string | null) {
    const gymId = getTenantGymId();
    if (!gymId) {
      this.logger.warn('No gym_id in tenant context — skipping metrics update');
      return null;
    }

    const existing = await tx.dashboardMetrics.findFirst({
      where: { gym_id: gymId, branch_id: branchId ?? null },
    });

    if (existing) return existing;

    // Auto-create row with zeroed counters
    try {
      return await tx.dashboardMetrics.create({
        data: {
          gym_id: gymId,
          branch_id: branchId ?? null,
        },
      });
    } catch (e: any) {
      // Unique constraint race — another request created it simultaneously
      if (e.code === 'P2002') {
        return tx.dashboardMetrics.findFirst({
          where: { gym_id: gymId, branch_id: branchId ?? null },
        });
      }
      throw e;
    }
  }

  // ── Atomic Increment/Decrement Helpers ───────────────────────

  /**
   * Increment a counter field atomically. Safe to call inside a $transaction.
   * Updates both the gym-wide row (branch_id=null) and the branch-specific row.
   */
  async increment(
    tx: any,
    field: 'total_members' | 'active_members' | 'total_staff' | 'active_staff' | 'check_ins_today' | 'check_ins_month' | 'expiring_memberships',
    delta: number = 1,
    branchId?: string | null,
  ) {
    const gymId = getTenantGymId();
    if (!gymId) return;

    // Ensure rows exist before incrementing
    await this.ensureRow(tx, null);
    if (branchId) await this.ensureRow(tx, branchId);

    // Gym-wide update
    await tx.dashboardMetrics.updateMany({
      where: { gym_id: gymId, branch_id: null },
      data: { [field]: { increment: delta } },
    });

    // Branch-specific update
    if (branchId) {
      await tx.dashboardMetrics.updateMany({
        where: { gym_id: gymId, branch_id: branchId },
        data: { [field]: { increment: delta } },
      });
    }
  }

  /**
   * Decrement a counter field, clamping to 0 (never goes negative).
   */
  async decrement(
    tx: any,
    field: 'total_members' | 'active_members' | 'total_staff' | 'active_staff' | 'check_ins_today' | 'check_ins_month' | 'expiring_memberships',
    delta: number = 1,
    branchId?: string | null,
  ) {
    const gymId = getTenantGymId();
    if (!gymId) return;

    // Fetch current value to prevent negative
    const gymRow = await this.ensureRow(tx, null);
    if (gymRow) {
      const current = gymRow[field] ?? 0;
      const safeDelta = Math.min(delta, current);
      if (safeDelta > 0) {
        await tx.dashboardMetrics.updateMany({
          where: { gym_id: gymId, branch_id: null },
          data: { [field]: { decrement: safeDelta } },
        });
      }
    }

    if (branchId) {
      const branchRow = await this.ensureRow(tx, branchId);
      if (branchRow) {
        const current = branchRow[field] ?? 0;
        const safeDelta = Math.min(delta, current);
        if (safeDelta > 0) {
          await tx.dashboardMetrics.updateMany({
            where: { gym_id: gymId, branch_id: branchId },
            data: { [field]: { decrement: safeDelta } },
          });
        }
      }
    }
  }

  /**
   * Add revenue amount to monthly_revenue counter.
   */
  async addRevenue(tx: any, amount: number, branchId?: string | null) {
    const gymId = getTenantGymId();
    if (!gymId) return;

    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"

    await this.ensureRow(tx, null);
    if (branchId) await this.ensureRow(tx, branchId);

    // Gym-wide revenue
    const gymRow = await tx.dashboardMetrics.findFirst({
      where: { gym_id: gymId, branch_id: null },
    });

    if (gymRow?.revenue_month !== currentMonth) {
      // New month — reset monthly_revenue
      await tx.dashboardMetrics.updateMany({
        where: { gym_id: gymId, branch_id: null },
        data: { monthly_revenue: amount, revenue_month: currentMonth, total_revenue: { increment: amount } },
      });
    } else {
      await tx.dashboardMetrics.updateMany({
        where: { gym_id: gymId, branch_id: null },
        data: { monthly_revenue: { increment: amount }, total_revenue: { increment: amount } },
      });
    }

    // Branch-level revenue
    if (branchId) {
      const branchRow = await tx.dashboardMetrics.findFirst({
        where: { gym_id: gymId, branch_id: branchId },
      });
      if (branchRow?.revenue_month !== currentMonth) {
        await tx.dashboardMetrics.updateMany({
          where: { gym_id: gymId, branch_id: branchId },
          data: { monthly_revenue: amount, revenue_month: currentMonth, total_revenue: { increment: amount } },
        });
      } else {
        await tx.dashboardMetrics.updateMany({
          where: { gym_id: gymId, branch_id: branchId },
          data: { monthly_revenue: { increment: amount }, total_revenue: { increment: amount } },
        });
      }
    }
  }

  // ── Read (fast path for dashboard) ───────────────────────────

  /**
   * Get materialized metrics for the current gym.
   * Returns null if no metrics row exists (first-time gym) OR if the row
   * is a stale auto-created placeholder (version === 0 — never projected
   * nor resynced). Returning null forces the caller to fall back to live
   * queries, which is correct behavior for a gym that hasn't had its
   * counters populated yet.
   */
  async getMetrics(branchId?: string | null) {
    const gymId = getTenantGymId();
    if (!gymId) return null;

    // DashboardMetrics model may not exist in the current Prisma schema.
    // Treat any access failure as "no materialized metrics" so the caller
    // falls back to live queries instead of returning 500.
    const delegate = (this.tenant.client as any).dashboardMetrics;
    if (!delegate?.findFirst) return null;

    try {
      const row = await delegate.findFirst({
        where: { gym_id: gymId, branch_id: branchId ?? null },
      });

      // version=0 means ensureRow() auto-created a zeroed row, but no projector
      // or fullResync has touched it yet. Treat as stale → fall back to live.
      if (!row || Number(row.version) === 0) return null;

      return row;
    } catch (err) {
      this.logger.warn(`getMetrics failed — falling back to live: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  /**
   * Get all branch-level metrics for the current gym.
   */
  async getAllBranchMetrics() {
    const gymId = getTenantGymId();
    if (!gymId) return [];

    return this.tenant.client.dashboardMetrics.findMany({
      where: { gym_id: gymId, branch_id: { not: null } },
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  // ── Full Resync (cron or manual) ─────────────────────────────

  /**
   * Recompute all counters from source tables.
   * Run periodically (e.g., nightly) to correct any drift.
   */
  async fullResync() {
    const gymId = getTenantGymId();
    if (!gymId) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.toDateString());
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

    const [
      totalMembers,
      activeMembers,
      totalStaff,
      activeStaff,
      monthlyRevenue,
      totalRevenue,
      checkInsToday,
      checkInsMonth,
      expiringMemberships,
    ] = await Promise.all([
      this.tenant.client.member.count(),
      this.tenant.client.member.count({ where: { status: 'active' } }),
      this.tenant.client.staff.count(),
      this.tenant.client.staff.count({ where: { is_active: true } }),
      this.tenant.client.payment.aggregate({
        where: { status: 'paid', paid_at: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.tenant.client.payment.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true },
      }),
      this.tenant.client.checkIn.count({
        where: { checked_in_at: { gte: startOfDay }, status: 'success' },
      }),
      this.tenant.client.checkIn.count({
        where: { checked_in_at: { gte: startOfMonth }, status: 'success' },
      }),
      this.tenant.client.memberMembership.count({
        where: { status: 'active', end_date: { gte: now, lte: thirtyDaysFromNow } },
      }),
    ]);

    const metricsData = {
      total_members: totalMembers,
      active_members: activeMembers,
      total_staff: totalStaff,
      active_staff: activeStaff,
      monthly_revenue: Number(monthlyRevenue._sum.amount || 0),
      total_revenue: Number(totalRevenue._sum.amount || 0),
      check_ins_today: checkInsToday,
      check_ins_month: checkInsMonth,
      expiring_memberships: expiringMemberships,
      revenue_month: now.toISOString().slice(0, 7),
      last_synced_at: now,
    };

    // Upsert gym-wide row (branch_id=null)
    await this.tenant.client.dashboardMetrics.upsert({
      where: { gym_id_branch_id: { gym_id: gymId, branch_id: null as any } },
      create: { gym_id: gymId, branch_id: null, ...metricsData },
      update: metricsData,
    });

    // Also resync per-branch rows so branch-specific dashboard reads hit the fast path
    const branches = await this.tenant.client.branch.findMany({
      where: { is_active: true },
      select: { id: true },
    });

    for (const branch of branches) {
      const bId = branch.id;
      const bFilter = { branch_id: bId };
      const [bTotal, bActive, bMonthlyRev, bTotalRev, bCheckInsToday, bCheckInsMonth, bExpiring] = await Promise.all([
        this.tenant.client.member.count({ where: bFilter }),
        this.tenant.client.member.count({ where: { status: 'active', ...bFilter } }),
        this.tenant.client.payment.aggregate({ where: { status: 'paid', paid_at: { gte: startOfMonth }, ...bFilter }, _sum: { amount: true } }),
        this.tenant.client.payment.aggregate({ where: { status: 'paid', ...bFilter }, _sum: { amount: true } }),
        this.tenant.client.checkIn.count({ where: { checked_in_at: { gte: startOfDay }, status: 'success', ...bFilter } }),
        this.tenant.client.checkIn.count({ where: { checked_in_at: { gte: startOfMonth }, status: 'success', ...bFilter } }),
        this.tenant.client.memberMembership.count({ where: { status: 'active', end_date: { gte: now, lte: thirtyDaysFromNow }, ...bFilter } }),
      ]);

      // Staff don't have branch_id — count is gym-wide only
      const branchMetrics = {
        total_members: bTotal,
        active_members: bActive,
        total_staff: 0,
        active_staff: 0,
        monthly_revenue: Number(bMonthlyRev._sum.amount || 0),
        total_revenue: Number(bTotalRev._sum.amount || 0),
        check_ins_today: bCheckInsToday,
        check_ins_month: bCheckInsMonth,
        expiring_memberships: bExpiring,
        revenue_month: now.toISOString().slice(0, 7),
        last_synced_at: now,
      };

      await this.tenant.client.dashboardMetrics.upsert({
        where: { gym_id_branch_id: { gym_id: gymId, branch_id: bId } },
        create: { gym_id: gymId, branch_id: bId, ...branchMetrics },
        update: branchMetrics,
      });
    }

    this.logger.log(`Dashboard metrics resynced for gym ${gymId} (${branches.length} branches)`);
  }
}
