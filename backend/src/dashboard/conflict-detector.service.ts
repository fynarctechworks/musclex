import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { resolveBranchScope } from '../common/branch-scope.util';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

/**
 * Wave 12 — Trainer Schedule Conflict Detector.
 *
 * Surfaces operational conflicts that would silently lose revenue or trigger
 * customer-facing failures if left unflagged:
 *
 *   - `trainer_double_booked`  — same trainer assigned to two overlapping
 *     scheduled sessions in the next 24h
 *   - `class_overfill`         — session at ≥100% capacity with waitlist
 *     piling up (different from the action-queue's class_overfill rule —
 *     here we only emit when the situation is *unresolvable* without intervention)
 *   - `no_trainer_assigned`    — scheduled session in next 24h without a
 *     trainer (or with a deactivated trainer record)
 *
 * Each conflict carries the same `evidence` shape used by ActionQueue so
 * it slots into the existing Action Stack without surface-level forking.
 */
export type ConflictKind =
  | 'trainer_double_booked'
  | 'class_overfill'
  | 'no_trainer_assigned';

export type ConflictSeverity = 'high' | 'medium' | 'low';

export interface ConflictEvidence {
  summary: string;
  source: string;
  trainer_name?: string;
  session_a?: { id: string; name: string; start_time: string; end_time: string };
  session_b?: { id: string; name: string; start_time: string; end_time: string };
  capacity?: number;
  enrolled?: number;
  waitlist?: number;
  fill_pct?: number;
}

export interface ScheduleConflict {
  id: string;
  kind: ConflictKind;
  severity: ConflictSeverity;
  title: string;
  reason: string;
  occurs_at: string;
  cta_label: string;
  cta_href: string;
  refs: {
    session_id?: string;
    session_ids?: string[];
    trainer_id?: string;
    branch_id?: string;
  };
  evidence: ConflictEvidence;
  generated_at: string;
}

type BranchFilter = { branch_id?: string | { in: string[] } };

@Injectable()
export class ConflictDetectorService {
  private readonly logger = new Logger(ConflictDetectorService.name);
  private static readonly HORIZON_HOURS = 24;

  constructor(private readonly tenant: TenantPrisma) {}

  /**
   * Run the three conflict rules in parallel. Failures in one rule never
   * block the others — the dashboard continues to render with whatever
   * data we have.
   */
  async detectConflicts(
    user?: JwtPayload,
    branchId?: string,
  ): Promise<ScheduleConflict[]> {
    const branchFilter = resolveBranchScope(user, branchId)
      .branchFilter as BranchFilter;
    const now = new Date();
    const horizon = new Date(now.getTime() + ConflictDetectorService.HORIZON_HOURS * 3600_000);

    const [doubles, overfills, noTrainers] = await Promise.allSettled([
      this.detectTrainerDoubleBookings(branchFilter, now, horizon),
      this.detectClassOverfill(branchFilter, now, horizon),
      this.detectNoTrainerAssigned(branchFilter, now, horizon),
    ]);

    const out: ScheduleConflict[] = [];
    for (const r of [doubles, overfills, noTrainers]) {
      if (r.status === 'fulfilled') out.push(...r.value);
      else this.logger.warn(`conflict rule failed: ${(r.reason as Error)?.message ?? r.reason}`);
    }

    // Highest severity / earliest occurrence first.
    const sevRank: Record<ConflictSeverity, number> = { high: 0, medium: 1, low: 2 };
    out.sort((a, b) => {
      const s = sevRank[a.severity] - sevRank[b.severity];
      if (s !== 0) return s;
      return new Date(a.occurs_at).getTime() - new Date(b.occurs_at).getTime();
    });
    return out;
  }

  // ── Rule: trainer double-booked ──────────────────────────────────

  /**
   * Pull all scheduled sessions in the horizon, group by trainer, and
   * detect any overlapping pairs (A.start < B.end && B.start < A.end).
   * Bounded at 200 sessions per branch slice — enough for the busiest
   * chain's 24h window, cheap on the DB.
   */
  private async detectTrainerDoubleBookings(
    branchFilter: BranchFilter,
    now: Date,
    horizon: Date,
  ): Promise<ScheduleConflict[]> {
    const sessions = await this.tenant.client.classSession.findMany({
      where: {
        status: 'scheduled',
        start_time: { gte: now, lte: horizon },
        ...branchFilter,
      },
      select: {
        id: true,
        name: true,
        trainer_id: true,
        branch_id: true,
        start_time: true,
        end_time: true,
        trainer: { select: { full_name: true, is_active: true } },
      },
      orderBy: { start_time: 'asc' },
      take: 200,
    });

    // Group by trainer
    const byTrainer = new Map<string, typeof sessions>();
    for (const s of sessions) {
      if (!s.trainer_id) continue;
      const arr = byTrainer.get(s.trainer_id) ?? [];
      arr.push(s);
      byTrainer.set(s.trainer_id, arr);
    }

    const seen = new Set<string>();
    const out: ScheduleConflict[] = [];
    for (const [trainerId, list] of byTrainer) {
      // O(n^2) on a per-trainer basis — n is tiny (rarely >10 sessions/24h).
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) continue;
          const aStart = new Date(a.start_time).getTime();
          const aEnd = new Date(a.end_time).getTime();
          const bStart = new Date(b.start_time).getTime();
          const bEnd = new Date(b.end_time).getTime();
          if (aStart < bEnd && bStart < aEnd) {
            const pairKey = [a.id, b.id].sort().join(':');
            if (seen.has(pairKey)) continue;
            seen.add(pairKey);
            const earliest = aStart < bStart ? a : b;
            out.push({
              id: `trainer_double_booked:${pairKey}`,
              kind: 'trainer_double_booked',
              severity: 'high',
              title: `${a.trainer?.full_name ?? 'Trainer'} is double-booked`,
              reason: `${a.name} overlaps with ${b.name}`,
              occurs_at: new Date(earliest.start_time as Date).toISOString(),
              cta_label: 'Resolve schedule',
              cta_href: `/staff/${trainerId}/schedule`,
              refs: {
                session_ids: [a.id, b.id],
                trainer_id: trainerId,
                branch_id: a.branch_id ?? b.branch_id ?? undefined,
              },
              evidence: {
                summary: `${a.trainer?.full_name ?? 'This trainer'} is assigned to two overlapping sessions in the next ${ConflictDetectorService.HORIZON_HOURS}h.`,
                source: 'conflict_detector_v1',
                trainer_name: a.trainer?.full_name ?? undefined,
                session_a: {
                  id: a.id,
                  name: a.name,
                  start_time: new Date(a.start_time).toISOString(),
                  end_time: new Date(a.end_time).toISOString(),
                },
                session_b: {
                  id: b.id,
                  name: b.name,
                  start_time: new Date(b.start_time).toISOString(),
                  end_time: new Date(b.end_time).toISOString(),
                },
              },
              generated_at: now.toISOString(),
            });
          }
        }
      }
    }
    return out;
  }

  // ── Rule: class overfill (≥100% with waitlist) ───────────────────

  private async detectClassOverfill(
    branchFilter: BranchFilter,
    now: Date,
    horizon: Date,
  ): Promise<ScheduleConflict[]> {
    const sessions = await this.tenant.client.classSession.findMany({
      where: {
        status: 'scheduled',
        start_time: { gte: now, lte: horizon },
        ...branchFilter,
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        enrolled_count: true,
        waitlist_count: true,
        start_time: true,
        branch_id: true,
      },
      take: 100,
    });

    const out: ScheduleConflict[] = [];
    for (const s of sessions) {
      if (s.capacity <= 0) continue;
      const fill = s.enrolled_count / s.capacity;
      // We only emit conflicts that need *intervention* — a class at 95%
      // is the action-queue's domain. Here we focus on overflow.
      if (fill < 1 && s.waitlist_count < 3) continue;

      const fillPct = Math.round(fill * 100);
      const severity: ConflictSeverity =
        fill >= 1 && s.waitlist_count > 0 ? 'high' : fill >= 1 ? 'medium' : 'medium';

      out.push({
        id: `class_overfill_alert:${s.id}`,
        kind: 'class_overfill',
        severity,
        title: `${s.name} overfilled at ${fillPct}%`,
        reason:
          s.waitlist_count > 0
            ? `${s.enrolled_count}/${s.capacity} booked · ${s.waitlist_count} on waitlist`
            : `${s.enrolled_count}/${s.capacity} booked — no headroom for walk-ins`,
        occurs_at: new Date(s.start_time as Date).toISOString(),
        cta_label: 'Open class',
        cta_href: `/classes/sessions/${s.id}`,
        refs: { session_id: s.id, branch_id: s.branch_id ?? undefined },
        evidence: {
          summary: `Session at ${fillPct}% capacity with ${s.waitlist_count} waitlisted.`,
          source: 'conflict_detector_v1',
          capacity: s.capacity,
          enrolled: s.enrolled_count,
          waitlist: s.waitlist_count,
          fill_pct: fillPct,
        },
        generated_at: now.toISOString(),
      });
    }
    return out;
  }

  // ── Rule: no trainer assigned (or assigned trainer is inactive) ──

  private async detectNoTrainerAssigned(
    branchFilter: BranchFilter,
    now: Date,
    horizon: Date,
  ): Promise<ScheduleConflict[]> {
    const sessions = await this.tenant.client.classSession.findMany({
      where: {
        status: 'scheduled',
        start_time: { gte: now, lte: horizon },
        ...branchFilter,
      },
      select: {
        id: true,
        name: true,
        trainer_id: true,
        branch_id: true,
        start_time: true,
        trainer: { select: { full_name: true, is_active: true } },
      },
      orderBy: { start_time: 'asc' },
      take: 100,
    });

    const out: ScheduleConflict[] = [];
    for (const s of sessions) {
      const noTrainer = !s.trainer_id;
      const trainerInactive = !!s.trainer && s.trainer.is_active === false;
      if (!noTrainer && !trainerInactive) continue;

      const reason = noTrainer
        ? 'No trainer assigned — assign one before doors open.'
        : `Assigned trainer (${s.trainer?.full_name ?? '—'}) is deactivated.`;
      out.push({
        id: `no_trainer_assigned:${s.id}`,
        kind: 'no_trainer_assigned',
        severity: 'high',
        title: `${s.name} has no active trainer`,
        reason,
        occurs_at: new Date(s.start_time as Date).toISOString(),
        cta_label: 'Assign trainer',
        cta_href: `/classes/sessions/${s.id}#assign`,
        refs: { session_id: s.id, branch_id: s.branch_id ?? undefined },
        evidence: {
          summary: reason,
          source: 'conflict_detector_v1',
          trainer_name: s.trainer?.full_name ?? undefined,
        },
        generated_at: now.toISOString(),
      });
    }
    return out;
  }
}
