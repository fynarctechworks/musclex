import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { toNumber } from './mappers';
import type {
  HealthSampleInputData,
  HealthIngestResultData,
  HealthSummaryData,
  HealthMetricSeriesData,
  WearableConnectionData,
  WearableConnectionListData,
  WearableConnectInput,
} from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER HEALTH SERVICE — quantified-health telemetry
 * ────────────────────────────────────────────────────────────────
 *
 * Ingests health samples synced from Apple HealthKit / Google Health Connect
 * (or entered manually), maintains the per-day rollups the dashboards read, and
 * manages the member's wearable connections + GDPR consent.
 *
 * Tenant safety: writes set gym_id explicitly (= member.tenantId); reads rely on
 * the $use middleware auto-injecting gym_id on top of the member_id filter. No
 * id is ever trusted from the client — identity comes only from @CurrentMember.
 *
 * Idempotency: re-syncing a sample is a no-op via the unique
 * (member_id, type, source, source_uuid) index + createMany skipDuplicates,
 * on top of the HTTP-level @Idempotent replay.
 */
@Injectable()
export class MemberHealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Batch-ingest samples, dedupe, and refresh the affected daily rollups. */
  async ingest(
    member: CurrentMemberContext,
    samples: HealthSampleInputData[],
  ): Promise<HealthIngestResultData> {
    const gymId = member.tenantId;

    // ── Consent gate: every non-manual source must be a CONNECTED provider.
    const wearableSources = [
      ...new Set(samples.map((s) => s.source).filter((s) => s !== 'manual')),
    ];
    if (wearableSources.length) {
      const connected = await this.prisma.memberWearableConnection.findMany({
        where: {
          member_id: member.memberId,
          provider: { in: wearableSources },
          status: 'connected',
        },
        select: { provider: true },
      });
      const ok = new Set(connected.map((c) => c.provider));
      const missing = wearableSources.filter((s) => !ok.has(s));
      if (missing.length) {
        // Surface as a structured 400 (handled by MemberExceptionFilter).
        throw MemberException.badRequest(
          `Connect these providers before syncing: ${missing.join(', ')}.`,
        );
      }
    }

    // ── Insert (idempotent: dupes on the provider-uuid index are skipped).
    const created = await this.prisma.memberHealthSample.createMany({
      data: samples.map((s) => ({
        gym_id: gymId,
        member_id: member.memberId,
        type: s.type,
        value: s.value,
        unit: s.unit,
        start_at: new Date(s.startAt),
        end_at: new Date(s.endAt),
        source: s.source,
        source_uuid: s.sourceUuid,
        metadata:
          s.metadata == null
            ? Prisma.JsonNull
            : (s.metadata as Prisma.InputJsonValue),
      })),
      skipDuplicates: true,
    });
    const accepted = created.count;

    // ── Recompute the daily rollup for each affected (type, day).
    const buckets = new Map<
      string,
      { type: string; day: Date; unit: string; source: string }
    >();
    const days = new Set<string>();
    for (const s of samples) {
      const day = startOfUtcDay(s.startAt);
      const dayKey = day.toISOString();
      days.add(dayKey);
      const key = `${s.type}|${dayKey}`;
      if (!buckets.has(key)) {
        buckets.set(key, { type: s.type, day, unit: s.unit, source: s.source });
      }
    }

    for (const { type, day, unit } of buckets.values()) {
      const next = new Date(day.getTime() + DAY_MS);

      // ── Conflict resolution: a member can sync the SAME metric from several
      // providers (e.g. steps from both Apple Health and a Garmin). Summing
      // across sources would double-count, so we pick ONE authoritative source
      // per (type, day) by a documented priority and roll up only its samples.
      // The winner is recorded in `primary_source` for transparency.
      const groups = await this.prisma.memberHealthSample.groupBy({
        by: ['source'],
        where: {
          member_id: member.memberId,
          type,
          start_at: { gte: day, lt: next },
        },
        _sum: { value: true },
        _min: { value: true },
        _max: { value: true },
        _avg: { value: true },
        _count: true,
      });
      if (groups.length === 0) continue; // nothing for this bucket (shouldn't happen)

      const primary = pickPrimarySource(
        type,
        groups.map((g) => g.source),
      );
      const win = groups.find((g) => g.source === primary) ?? groups[0];

      const rollup = {
        total: toNumber(win._sum.value) ?? 0,
        min: toNumber(win._min.value),
        max: toNumber(win._max.value),
        avg: toNumber(win._avg.value),
        sample_count: win._count,
        unit,
        primary_source: win.source,
      };
      await this.prisma.memberHealthDaily.upsert({
        where: {
          member_id_day_type: { member_id: member.memberId, day, type },
        },
        create: { gym_id: gymId, member_id: member.memberId, day, type, ...rollup },
        update: rollup,
      });
    }

    // ── Stamp last_synced_at on the providers present in this batch.
    if (wearableSources.length) {
      await this.prisma.memberWearableConnection.updateMany({
        where: { member_id: member.memberId, provider: { in: wearableSources } },
        data: { last_synced_at: new Date() },
      });
    }

    return {
      accepted,
      duplicates: samples.length - accepted,
      daysAffected: days.size,
    };
  }

  /** Per-metric daily rollups over [from, to] (defaults to the last 7 days). */
  async getSummary(
    member: CurrentMemberContext,
    fromStr?: string,
    toStr?: string,
    typesStr?: string,
  ): Promise<HealthSummaryData> {
    const to = toStr ? startOfUtcDay(toStr) : startOfUtcDay(new Date());
    const from = fromStr
      ? startOfUtcDay(fromStr)
      : new Date(to.getTime() - 6 * DAY_MS);
    const types = (typesStr ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const rows = await this.prisma.memberHealthDaily.findMany({
      where: {
        member_id: member.memberId,
        day: { gte: from, lte: to },
        ...(types.length ? { type: { in: types } } : {}),
      },
      orderBy: [{ type: 'asc' }, { day: 'asc' }],
    });

    const byType = new Map<string, HealthMetricSeriesData>();
    for (const r of rows) {
      let series = byType.get(r.type);
      if (!series) {
        series = { type: r.type, unit: r.unit, points: [] };
        byType.set(r.type, series);
      }
      series.points!.push({
        day: dateStr(r.day),
        total: toNumber(r.total) ?? 0,
        min: toNumber(r.min),
        max: toNumber(r.max),
        avg: toNumber(r.avg),
        sampleCount: r.sample_count,
      });
    }

    return {
      from: dateStr(from),
      to: dateStr(to),
      metrics: [...byType.values()],
    };
  }

  /** The member's linked providers (connected + revoked). */
  async listConnections(
    member: CurrentMemberContext,
  ): Promise<WearableConnectionListData> {
    const rows = await this.prisma.memberWearableConnection.findMany({
      where: { member_id: member.memberId },
      orderBy: { created_at: 'asc' },
    });
    return { connections: rows.map(toConnection) };
  }

  /** Link (or re-link) a provider, stamping explicit consent. */
  async connect(
    member: CurrentMemberContext,
    dto: WearableConnectInput,
  ): Promise<WearableConnectionData> {
    const now = new Date();
    const row = await this.prisma.memberWearableConnection.upsert({
      where: {
        member_id_provider: {
          member_id: member.memberId,
          provider: dto.provider,
        },
      },
      create: {
        gym_id: member.tenantId,
        member_id: member.memberId,
        provider: dto.provider,
        status: 'connected',
        consented_at: now,
        external_user_id: dto.externalUserId ?? null,
        scopes:
          dto.scopes == null
            ? Prisma.JsonNull
            : (dto.scopes as Prisma.InputJsonValue),
      },
      update: {
        status: 'connected',
        consented_at: now,
        external_user_id: dto.externalUserId ?? null,
        ...(dto.scopes == null
          ? {}
          : { scopes: dto.scopes as Prisma.InputJsonValue }),
      },
    });
    return toConnection(row);
  }

  /** Revoke a provider link (samples already ingested are retained). */
  async revoke(
    member: CurrentMemberContext,
    provider: string,
  ): Promise<WearableConnectionData> {
    const existing = await this.prisma.memberWearableConnection.findFirst({
      where: { member_id: member.memberId, provider },
    });
    if (!existing) throw MemberException.notFound('Connection not found.');

    await this.prisma.memberWearableConnection.updateMany({
      where: { member_id: member.memberId, provider },
      data: { status: 'revoked' },
    });
    return toConnection({ ...existing, status: 'revoked' });
  }
}

// ── helpers ──────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/**
 * Source-of-truth priority when several providers report the SAME metric on the
 * same day (conflict resolution for the daily rollup).
 *
 * Two documented orders, highest trust first:
 *  - Body composition (weight/fat): the member's smart scale or own manual entry
 *    is the ground truth; a wearable's estimate is a fallback.
 *  - Everything else (activity, heart, sleep, HRV): a dedicated continuous
 *    wearable beats a phone health-store aggregate, which beats a manual guess.
 *
 * Deterministic and explainable on purpose — the winner is stored in
 * `primary_source` so the number on screen is always traceable to one device.
 */
const BODY_COMPOSITION = new Set(['body_weight', 'body_fat']);
const BODY_COMP_PRIORITY = [
  'scale',
  'manual',
  'garmin',
  'fitbit',
  'apple_health',
  'health_connect',
];
const DEFAULT_PRIORITY = [
  'garmin',
  'fitbit',
  'apple_health',
  'health_connect',
  'scale',
  'manual',
];

/** Pick the authoritative source for a (type, day) from the sources present. */
function pickPrimarySource(type: string, present: string[]): string {
  const order = BODY_COMPOSITION.has(type) ? BODY_COMP_PRIORITY : DEFAULT_PRIORITY;
  const set = new Set(present);
  return order.find((s) => set.has(s)) ?? present[0];
}

/** UTC midnight of the given date/ISO string (daily-rollup bucket key). */
function startOfUtcDay(input: Date | string): Date {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** YYYY-MM-DD for a Date (used for `day`/`from`/`to` contract fields). */
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toConnection(row: {
  provider: string;
  status: string;
  consented_at: Date;
  last_synced_at: Date | null;
}): WearableConnectionData {
  return {
    provider: row.provider,
    status: row.status as 'connected' | 'revoked',
    consentedAt: row.consented_at.toISOString(),
    lastSyncedAt: row.last_synced_at ? row.last_synced_at.toISOString() : null,
  };
}
