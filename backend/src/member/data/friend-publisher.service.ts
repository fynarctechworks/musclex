import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * ────────────────────────────────────────────────────────────────
 * FRIEND PUBLISHER — the only writer of a member's shared data
 * ────────────────────────────────────────────────────────────────
 *
 * A friend is usually at ANOTHER gym, and their workouts live in that gym's
 * schema. Reading it would be a cross-tenant read — the worst failure this
 * system has. So friends never read a gym schema at all: this service copies
 * the summary a member has OPTED INTO sharing out to `public`, and every
 * friend-facing query reads only from there.
 *
 * Two rules hold the whole design together:
 *
 *   1. Publishing is gated on the OWNER's own flag, checked here on every
 *      write. A caller cannot opt someone else in by passing the wrong id.
 *   2. Publishing must never break logging a workout. A member's session is
 *      their record of training; a social copy failing is not a reason to lose
 *      it. Every entry point is therefore best-effort and swallows its errors
 *      after logging them.
 */
@Injectable()
export class FriendPublisherService {
  private readonly log = new Logger(FriendPublisherService.name);

  /**
   * How much published history a friend can see.
   *
   * Pruned HERE, on write, rather than by a scheduled job: this is the only
   * table in the friends feature that would otherwise grow with every session
   * ever logged. One extra delete on a path that is already writing costs
   * nothing and needs no cron, and holds storage at roughly this many rows per
   * sharing member instead of climbing forever. Nobody scrolls to a friend's
   * workout from last year.
   */
  private static readonly RETAIN_DAYS = 90;

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
  ) {}

  /**
   * Publish one finished session, if the member shares sessions.
   *
   * Best-effort by contract: callers sit on the workout-logging path and must
   * not fail because the social copy did.
   */
  async publishSession(
    member: CurrentMemberContext,
    logId: string,
    sets: { exerciseId: string; reps?: number; weight?: number; unit?: string }[],
    span?: { startedAt?: string; endedAt?: string },
  ): Promise<void> {
    try {
      if (!member.appUserId) return;
      const prefs = await this.pub.appUser.findUnique({
        where: { id: member.appUserId },
        select: { share_sessions: true },
      });
      if (!prefs?.share_sessions) return;

      // Names come from the member's OWN gym — the one schema we are entitled
      // to read — and are stored on the row so no consumer ever has to come
      // back across the boundary for them.
      const ids = [...new Set(sets.map((s) => s.exerciseId))];
      const rows = await this.tenant.client.exercise.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      const nameById = new Map(rows.map((r) => [r.id, r.name]));

      // Volume in canonical kg. A pounds-logged set is converted here rather
      // than stored as-is, or two friends' totals would not be comparable.
      let volume = 0;
      for (const s of sets) {
        const kg = s.unit === 'lb' ? (s.weight ?? 0) * 0.45359237 : (s.weight ?? 0);
        volume += kg * (s.reps ?? 0);
      }

      const performedAt = span?.startedAt ? new Date(span.startedAt) : new Date();
      const duration =
        span?.startedAt && span?.endedAt
          ? Math.max(
              0,
              Math.round(
                (new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime()) / 1000,
              ),
            )
          : null;

      const data = {
        performed_at: performedAt,
        exercise_count: ids.length,
        set_count: sets.length,
        total_volume_kg: volume > 0 ? volume.toFixed(2) : null,
        duration_seconds: duration,
        exercise_names: ids.map((id) => nameById.get(id) ?? 'Exercise'),
      };

      // Keyed on the source log so re-submitting the same workout — the offline
      // outbox does retry — updates the published copy instead of adding a
      // second one.
      //
      // Done as find-then-write rather than upsert(): the unique index is
      // PARTIAL (`WHERE source_log_id IS NOT NULL`, since a session may have no
      // source), which Prisma cannot express and which a plain ON CONFLICT
      // target would not match.
      const existing = await this.pub.appUserSession.findFirst({
        where: { app_user_id: member.appUserId, source_log_id: logId },
        select: { id: true },
      });
      if (existing) {
        await this.pub.appUserSession.update({ where: { id: existing.id }, data });
      } else {
        await this.pub.appUserSession.create({
          data: { app_user_id: member.appUserId, source_log_id: logId, ...data },
        });
      }

      await this.prune(member.appUserId);
    } catch (e) {
      this.log.warn(
        `publishSession failed for app_user ${member.appUserId}: ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
  }

  /**
   * Publish the member's best lifts, if they share PRs.
   *
   * Keyed on the lowercased exercise NAME, never the id: exercise ids are
   * gym-scoped, so an id is meaningless to the friend comparing against it.
   */
  async publishPrs(member: CurrentMemberContext, exerciseIds?: string[]): Promise<void> {
    try {
      if (!member.appUserId || !member.memberId) return;
      const prefs = await this.pub.appUser.findUnique({
        where: { id: member.appUserId },
        select: { share_prs: true },
      });
      if (!prefs?.share_prs) return;

      // Read the STORED records rather than trusting a caller's summary: the
      // personal_records row is the authority on weight, reps and unit, and the
      // workout response shape carries neither reps nor unit.
      const records = await this.tenant.client.personalRecord.findMany({
        where: {
          member_id: member.memberId,
          ...(exerciseIds?.length ? { exercise_id: { in: exerciseIds } } : {}),
        },
        select: {
          exercise_id: true,
          weight: true,
          reps: true,
          unit: true,
          achieved_at: true,
          exercise: { select: { name: true } },
        },
      });
      if (records.length === 0) return;

      for (const r of records) {
        const name = r.exercise?.name;
        if (!name) continue;
        const key = name.trim().toLowerCase();
        const achieved = r.achieved_at ?? new Date();
        // Canonical kg, so two friends' numbers are comparable regardless of
        // the unit either of them logs in.
        const weightKg = r.unit === 'lb' ? Number(r.weight) * 0.45359237 : Number(r.weight);
        await this.pub.appUserPr.upsert({
          where: { app_user_id_exercise_name: { app_user_id: member.appUserId, exercise_name: key } },
          create: {
            app_user_id: member.appUserId,
            exercise_name: key,
            weight_kg: weightKg.toFixed(2),
            reps: r.reps,
            achieved_at: achieved,
          },
          update: { weight_kg: weightKg.toFixed(2), reps: r.reps, achieved_at: achieved },
        });
      }
    } catch (e) {
      this.log.warn(
        `publishPrs failed for app_user ${member.appUserId}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /**
   * Backfill every current PR when a member first turns PR sharing on.
   *
   * Without this, enabling the switch and immediately comparing shows nothing
   * until the next workout, which reads as the feature being broken rather than
   * as "no data yet".
   */
  async backfillPrs(member: CurrentMemberContext): Promise<void> {
    // No id filter: publish every record the member holds.
    await this.publishPrs(member);
  }

  /**
   * Stop sharing a category: withdraw what is already published.
   *
   * Turning a switch off has to mean the data is gone, not merely that new rows
   * stop appearing. Leaving old rows visible would make "off" a lie.
   */
  async withdraw(appUserId: string, what: 'sessions' | 'prs'): Promise<void> {
    if (what === 'sessions') {
      await this.pub.appUserSession.deleteMany({ where: { app_user_id: appUserId } });
    } else {
      await this.pub.appUserPr.deleteMany({ where: { app_user_id: appUserId } });
    }
  }

  /** Drop published sessions past the retention window. */
  private async prune(appUserId: string): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FriendPublisherService.RETAIN_DAYS);
    await this.pub.appUserSession.deleteMany({
      where: { app_user_id: appUserId, performed_at: { lt: cutoff } },
    });
  }
}
