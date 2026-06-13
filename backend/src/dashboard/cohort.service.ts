import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { JwtPayload } from '../common';

export interface CohortRetention {
  cohort_month: string; // YYYY-MM
  size: number;
  retention: number[]; // % active at offset 0..N
}

export interface CohortResponse {
  cohorts: CohortRetention[];
  generated_at: string;
}

interface CacheEntry {
  data: CohortResponse;
  expires_at: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const MAX_COHORTS = 12;
const INFLIGHT_TIMEOUT_MS = 30_000;

/**
 * Cohort retention service.
 *
 * For the last `months` cohort months (signup month), compute retention curves:
 *   - cohort = members signed up in that calendar month
 *   - retained at offset M = members in cohort with >=1 check-in OR active
 *     subscription window overlapping (cohort_month + M, cohort_month + M + 1).
 */
@Injectable()
export class CohortService {
  private cache = new Map<string, CacheEntry>();
  /**
   * Per-cache-key inflight promise. Prevents cache stampede: if 30 viewers
   * hit a cold key concurrently, only one heavy compute runs; the rest await
   * the same promise.
   */
  private inflight = new Map<string, Promise<CohortResponse>>();

  constructor(private tenant: TenantPrisma) {}

  private getBranchFilter(user?: JwtPayload, branchId?: string) {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  private cacheKey(user: JwtPayload, branchId?: string, months = 12): string {
    const tenant = user.studio_id ?? 'global';
    const scope = branchId ?? (user.branch_ids?.join(',') ?? user.role);
    return `${tenant}:${scope}:${months}`;
  }

  async getCohorts(
    user: JwtPayload,
    branchId?: string,
    months = 12,
  ): Promise<CohortResponse> {
    const cappedMonths = Math.min(Math.max(months, 1), MAX_COHORTS);
    const key = this.cacheKey(user, branchId, cappedMonths);
    const cached = this.cache.get(key);
    const now = Date.now();
    if (cached && cached.expires_at > now) {
      return cached.data;
    }

    // Stampede guard: dedupe concurrent compute calls per cache key.
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this.computeCohorts(user, branchId, cappedMonths)
      .then((data) => {
        this.cache.set(key, { data, expires_at: Date.now() + CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        // Always clear inflight after settle so retries are possible after a failure.
        this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    // Safety: never let a stuck promise pin the inflight map forever.
    setTimeout(() => this.inflight.delete(key), INFLIGHT_TIMEOUT_MS).unref?.();
    return promise;
  }

  private async computeCohorts(
    user: JwtPayload,
    branchId: string | undefined,
    cappedMonths: number,
  ): Promise<CohortResponse> {
    const branchFilter = this.getBranchFilter(user, branchId);

    // Build cohort window: from `cappedMonths` months ago to now (start of month).
    const today = new Date();
    const cohortStarts: Date[] = [];
    for (let i = cappedMonths - 1; i >= 0; i--) {
      cohortStarts.push(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1)),
      );
    }

    const earliestCohort = cohortStarts[0];

    // Members signed up since earliest cohort (use created_at as signup proxy).
    const members = await this.tenant.client.member.findMany({
      where: {
        created_at: { gte: earliestCohort },
        ...branchFilter,
      },
      select: {
        id: true,
        created_at: true,
      },
    });

    if (members.length === 0) {
      return {
        cohorts: cohortStarts.map((d) => ({
          cohort_month: this.formatMonth(d),
          size: 0,
          retention: [],
        })),
        generated_at: new Date().toISOString(),
      };
    }

    const memberIds = members.map((m) => m.id);

    // Group members into cohorts.
    const cohortMap = new Map<string, string[]>(); // cohort_month -> [memberId]
    for (const cohortStart of cohortStarts) {
      cohortMap.set(this.formatMonth(cohortStart), []);
    }
    for (const m of members) {
      const key = this.formatMonth(
        new Date(
          Date.UTC(
            m.created_at.getUTCFullYear(),
            m.created_at.getUTCMonth(),
            1,
          ),
        ),
      );
      const list = cohortMap.get(key);
      if (list) list.push(m.id);
    }

    // Pull check-ins for these members within the analysis window.
    const checkIns = await this.tenant.client.checkIn.findMany({
      where: {
        member_id: { in: memberIds },
        checked_in_at: { gte: earliestCohort },
        status: 'success',
      },
      select: {
        member_id: true,
        checked_in_at: true,
      },
    });

    // Pull memberships overlapping the analysis window.
    const memberships = await this.tenant.client.memberMembership.findMany({
      where: {
        member_id: { in: memberIds },
      },
      select: {
        member_id: true,
        start_date: true,
        end_date: true,
      },
    });

    // Build per-member set of "active month indices" (absolute YYYYMM).
    const memberActiveMonths = new Map<string, Set<number>>();
    const ensure = (memberId: string) => {
      let s = memberActiveMonths.get(memberId);
      if (!s) {
        s = new Set<number>();
        memberActiveMonths.set(memberId, s);
      }
      return s;
    };

    for (const c of checkIns) {
      const idx = this.monthIndex(c.checked_in_at);
      ensure(c.member_id).add(idx);
    }

    for (const ms of memberships) {
      if (!ms.start_date) continue;
      const startIdx = this.monthIndex(ms.start_date);
      const endIdx = ms.end_date
        ? this.monthIndex(ms.end_date)
        : this.monthIndex(today);
      const set = ensure(ms.member_id);
      for (let i = startIdx; i <= endIdx; i++) set.add(i);
    }

    // For each cohort, calculate retention[m] = % of cohort members with active month at offset m.
    const cohorts: CohortRetention[] = [];
    const todayIdx = this.monthIndex(today);

    for (const cohortStart of cohortStarts) {
      const cohortKey = this.formatMonth(cohortStart);
      const ids = cohortMap.get(cohortKey) ?? [];
      const cohortIdx = this.monthIndex(cohortStart);
      const maxOffset = todayIdx - cohortIdx;
      const retention: number[] = [];
      for (let m = 0; m <= maxOffset; m++) {
        if (ids.length === 0) {
          retention.push(0);
          continue;
        }
        const targetIdx = cohortIdx + m;
        let activeCount = 0;
        for (const id of ids) {
          const set = memberActiveMonths.get(id);
          if (set && set.has(targetIdx)) activeCount++;
        }
        retention.push(Math.round((activeCount / ids.length) * 1000) / 10); // one decimal %
      }
      cohorts.push({
        cohort_month: cohortKey,
        size: ids.length,
        retention,
      });
    }

    return {
      cohorts,
      generated_at: new Date().toISOString(),
    };
  }

  /** Convert a Date to a comparable integer YYYY*12+MM index. */
  private monthIndex(d: Date): number {
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  }

  private formatMonth(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
