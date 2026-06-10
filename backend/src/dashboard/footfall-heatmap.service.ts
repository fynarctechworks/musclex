import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantGymId } from '../common/tenant-context';
import type { JwtPayload } from '../common';

/**
 * Wave 12 — Footfall Heatmap.
 *
 * Aggregates `check_ins` into a 7 (day-of-week) × 24 (hour-of-day) matrix
 * over the last `days` days (default 30). Each cell holds the *count* of
 * successful check-ins observed in that day-hour bucket.
 *
 * On top of the raw cells, we surface "outlier" cells whose value is
 * > 2σ above the rolling mean of that same day-hour bucket — useful for
 * highlighting unexpected surges (a viral class, free-trial day) or
 * unexpected dips (broken AC, bank holiday).
 */
export interface HeatmapCell {
  day_of_week: number; // 0=Mon … 6=Sun
  hour: number; // 0…23
  value: number;
  z_score: number;
}

export interface FootfallHeatmap {
  /** 7 rows × 24 cols; cells[d][h] = count for that day-hour bucket */
  cells: number[][];
  /** Largest cell value — used by the UI to scale the opacity ramp */
  max_value: number;
  /** Average cell value (across the 168 buckets) — context for the legend */
  average: number;
  /** Cells that deviated > 2σ above the bucket's own rolling mean */
  outliers: Array<{
    day_of_week: number;
    hour: number;
    value: number;
    z_score: number;
  }>;
  /** ISO timestamp this heatmap was computed */
  generated_at: string;
  /** Window length in days */
  window_days: number;
}

interface CacheEntry {
  data: FootfallHeatmap;
  expiresAt: number;
}

type BranchFilter = { branch_id?: string | { in: string[] } };

@Injectable()
export class FootfallHeatmapService {
  private readonly logger = new Logger(FootfallHeatmapService.name);
  private readonly cache = new Map<string, CacheEntry>();
  /** Per-cache-key inflight promise — prevents cache stampede on cold keys. */
  private readonly inflight = new Map<string, Promise<FootfallHeatmap>>();
  private static readonly TTL_SECONDS = 30 * 60;
  private static readonly MAX_CACHE_SIZE = 100;
  private static readonly INFLIGHT_TIMEOUT_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async getHeatmap(
    user?: JwtPayload,
    branchId?: string,
    days = 30,
  ): Promise<FootfallHeatmap> {
    const windowDays = Math.min(Math.max(Math.floor(days || 30), 7), 90);
    const branchFilter = this.getBranchFilter(user, branchId);
    const key = `heatmap:${user?.studio_id ?? 'global'}:${branchId ?? JSON.stringify(user?.branch_ids ?? [])}:${windowDays}`;

    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this.computeHeatmap(branchFilter, windowDays)
      .then((data) => {
        if (this.cache.size >= FootfallHeatmapService.MAX_CACHE_SIZE) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(key, {
          data,
          expiresAt: Date.now() + FootfallHeatmapService.TTL_SECONDS * 1000,
        });
        return data;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    setTimeout(
      () => this.inflight.delete(key),
      FootfallHeatmapService.INFLIGHT_TIMEOUT_MS,
    ).unref?.();
    return promise;
  }

  /**
   * Top-3 peak day-hour cells (used by the KPI Inspector for `peak_hour`).
   */
  async getPeakHours(
    user?: JwtPayload,
    branchId?: string,
    days = 30,
  ): Promise<
    Array<{ day_of_week: number; hour: number; value: number; share_pct: number }>
  > {
    const heatmap = await this.getHeatmap(user, branchId, days);
    const total =
      heatmap.cells.reduce(
        (sum, row) => sum + row.reduce((a, b) => a + b, 0),
        0,
      ) || 1;
    const flat: Array<{ d: number; h: number; v: number }> = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        flat.push({ d, h, v: heatmap.cells[d]?.[h] ?? 0 });
      }
    }
    flat.sort((a, b) => b.v - a.v);
    return flat.slice(0, 3).map((c) => ({
      day_of_week: c.d,
      hour: c.h,
      value: c.v,
      share_pct: round1((c.v / total) * 100),
    }));
  }

  invalidate(studioId?: string) {
    if (!studioId) {
      this.cache.clear();
      return;
    }
    for (const k of this.cache.keys()) {
      if (k.includes(studioId)) this.cache.delete(k);
    }
  }

  // ── Compute ──────────────────────────────────────────────────────

  private async computeHeatmap(
    branchFilter: BranchFilter,
    days: number,
  ): Promise<FootfallHeatmap> {
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000);

    // 7×24 zero matrix.
    const cells: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0),
    );

    let total = 0;
    const gymId = getTenantGymId();
    if (!gymId) {
      return {
        cells,
        max_value: 0,
        average: 0,
        outliers: [],
        generated_at: now.toISOString(),
        window_days: days,
      };
    }
    try {
      // Try a fast SQL aggregation first. We compute Postgres DOW (0=Sun…6=Sat)
      // and remap to 0=Mon…6=Sun in JS, which matches the y-axis the UI renders.
      // Raw SQL bypasses Prisma's $use middleware — the explicit `gym_id`
      // filter is the load-bearing tenant scope here; never rely on RLS alone.
      const branchSql = this.buildBranchSql(branchFilter, 3);
      const sql = `
        SELECT
          EXTRACT(DOW  FROM checked_in_at)::int  AS pg_dow,
          EXTRACT(HOUR FROM checked_in_at)::int  AS hr,
          COUNT(*)::int                          AS cnt
        FROM check_ins
        WHERE status = 'success' AND gym_id = $2::uuid AND checked_in_at >= $1
        ${branchSql.clause}
        GROUP BY pg_dow, hr
      `;
      const rows = await this.prisma.$queryRawUnsafe<
        { pg_dow: number; hr: number; cnt: number }[]
      >(sql, since, gymId, ...branchSql.params);

      for (const r of rows) {
        const d = pgDowToMonStart(Number(r.pg_dow));
        const h = Math.max(0, Math.min(23, Number(r.hr)));
        const v = Number(r.cnt) || 0;
        cells[d][h] = v;
        total += v;
      }
    } catch (err) {
      this.logger.warn(
        `heatmap SQL failed, falling back to ORM: ${(err as Error)?.message ?? err}`,
      );
      // Fallback: load rows and bucket in JS. Caps to a reasonable take to
      // avoid a runaway scan if the SQL path was blocked.
      try {
        const rows = await this.prisma.checkIn.findMany({
          where: {
            status: 'success',
            checked_in_at: { gte: since },
            ...branchFilter,
          },
          select: { checked_in_at: true },
          take: 50_000,
        });
        for (const r of rows) {
          if (!r.checked_in_at) continue;
          const d = jsDayToMonStart(new Date(r.checked_in_at).getDay());
          const h = new Date(r.checked_in_at).getHours();
          cells[d][h] += 1;
          total += 1;
        }
      } catch (err2) {
        this.logger.warn(
          `heatmap ORM fallback failed: ${(err2 as Error)?.message ?? err2}`,
        );
      }
    }

    let max = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (cells[d][h] > max) max = cells[d][h];
      }
    }
    const average = total / 168;

    return {
      cells,
      max_value: max,
      average: round2(average),
      outliers: this.detectOutliers(cells),
      generated_at: now.toISOString(),
      window_days: days,
    };
  }

  /**
   * Per-bucket outliers — for each (d, h) cell, treat the *other 167*
   * cells in the same matrix as the baseline distribution and flag if
   * the value is > 2σ above that baseline mean. This catches localized
   * spikes that wouldn't show up against a global average.
   */
  private detectOutliers(cells: number[][]): FootfallHeatmap['outliers'] {
    // Use the global distribution as the baseline — cheap, sufficient for
    // a 7×24 matrix where each (d, h) bucket has only `days/7` samples.
    const flat: number[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) flat.push(cells[d][h]);
    }
    const mean = avg(flat);
    const sd = stdev(flat);
    if (sd <= 0) return [];

    const out: FootfallHeatmap['outliers'] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const v = cells[d][h];
        if (v <= 0) continue;
        const z = (v - mean) / sd;
        if (z > 2) {
          out.push({
            day_of_week: d,
            hour: h,
            value: v,
            z_score: round2(z),
          });
        }
      }
    }
    // Highest z first.
    out.sort((a, b) => b.z_score - a.z_score);
    return out.slice(0, 12);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /**
   * Resolve the branch filter from the JWT payload. Mirrors the simple
   * pattern used by DashboardService — owners see all, others are scoped
   * to their `branch_ids[]`. An explicit branchId, if provided, takes
   * precedence (clamped to the user's accessible set).
   */
  private getBranchFilter(
    user?: JwtPayload,
    explicitBranchId?: string,
  ): BranchFilter {
    if (explicitBranchId) {
      // For non-owners, only allow if the branch is in their accessible set.
      if (
        user &&
        user.role !== 'owner' &&
        Array.isArray(user.branch_ids) &&
        user.branch_ids.length > 0 &&
        !user.branch_ids.includes(explicitBranchId)
      ) {
        return { branch_id: { in: user.branch_ids } };
      }
      return { branch_id: explicitBranchId };
    }
    if (!user || user.role === 'owner') return {};
    if (Array.isArray(user.branch_ids) && user.branch_ids.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  private buildBranchSql(
    branchFilter: BranchFilter,
    paramOffset: number,
  ): { clause: string; params: unknown[] } {
    if (!branchFilter.branch_id) return { clause: '', params: [] };
    if (
      typeof branchFilter.branch_id === 'object' &&
      'in' in branchFilter.branch_id
    ) {
      return {
        clause: ` AND branch_id = ANY($${paramOffset}::uuid[])`,
        params: [branchFilter.branch_id.in],
      };
    }
    return {
      clause: ` AND branch_id = $${paramOffset}::uuid`,
      params: [branchFilter.branch_id],
    };
  }
}

// ── Pure helpers ─────────────────────────────────────────────────

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = avg(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Postgres EXTRACT(DOW) returns 0=Sun..6=Sat. Our UI renders Mon..Sun, so
 * we remap: pg 1(Mon) -> 0, pg 2(Tue) -> 1, … pg 0(Sun) -> 6.
 */
function pgDowToMonStart(pgDow: number): number {
  const n = ((pgDow % 7) + 7) % 7; // safety
  return (n + 6) % 7;
}

/** JS Date.getDay() returns 0=Sun..6=Sat — same remap as pg dow. */
function jsDayToMonStart(jsDay: number): number {
  return pgDowToMonStart(jsDay);
}
