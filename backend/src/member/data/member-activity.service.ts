import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../node_modules/.prisma/client-public';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { isSportKey, SPORT_TYPES } from './sport-types';
import type { ActivityCreateDto, ActivityStreamsDto, ActivityUpdateDto } from './dto';
import { decodePolyline, encodePolyline } from './polyline';
import { chartSeries, splitsFrom, zoneDistribution } from './activity-analysis';
import { DEFAULT_HR_MAX, DEFAULT_HR_REST, zoneBands } from './training-load';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER ACTIVITY SERVICE — workouts of every sport
 * ────────────────────────────────────────────────────────────────
 *
 * Lives entirely in `public`, keyed by app_user_id. An activity belongs to the
 * PERSON: a run in a park has no gym, and a member who moves studios must keep
 * their history. No gym schema is read or written here, and none of these
 * models carry gym_id — so the tenant-model set is untouched and this adds no
 * cross-gym leak surface. The drift guard in tenant-models.spec proves it.
 *
 * THE CROSS-USER GATE: every read and write filters on the appUserId taken from
 * the verified token. No id is ever accepted from the client for ownership.
 * `updateMany`/`deleteMany` with the owner in the WHERE is used deliberately
 * over `update`-by-id, so a mismatched owner affects zero rows rather than
 * throwing after the fact.
 */
@Injectable()
export class MemberActivityService {
  /** Feed and list pages. Enough for a screen, small enough for one request. */
  private static readonly PAGE = 20;

  /**
   * A hard ceiling on one uploaded series.
   *
   * Ten hours at 1 Hz. Long enough for an ultra, short enough that a broken or
   * hostile client cannot post a hundred-megabyte array into a jsonb column.
   */
  private static readonly MAX_POINTS = 36_000;

  /**
   * Heatmap limits.
   *
   * 400 routes at 120 points is ~48k coordinates — around 500 KB encoded, and
   * more than enough ink to show where somebody habitually goes. The detail
   * lost by thinning to 120 points is detail no overlaid heatmap could show
   * anyway: at that zoom, two runs down the same street are the same pixels.
   */
  private static readonly MAX_ROUTES = 400;

  private static readonly ROUTE_POINTS = 120;

  private static readonly MIN_ROUTE_POINTS = 8;

  private static readonly STREAM_TYPES = new Set([
    'latlng', 'time', 'distance', 'altitude', 'heartrate',
    'cadence', 'velocity', 'watts', 'temperature', 'moving',
  ]);

  constructor(private readonly pub: PublicPrismaService) {}

  /** The sports a member can record. Static, but served so the app never
   *  hard-codes a list that then drifts from what the server will accept. */
  sports() {
    return { sports: SPORT_TYPES };
  }

  private num(v: Prisma.Decimal | number | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    return typeof v === 'number' ? v : Number(v);
  }

  private toSummary(a: any) {
    return {
      id: a.id,
      sportType: a.sport_type,
      title: a.title,
      source: a.source,
      startedAt: a.started_at.toISOString(),
      endedAt: a.ended_at ? a.ended_at.toISOString() : null,
      elapsedSeconds: a.elapsed_seconds,
      movingSeconds: a.moving_seconds,
      distanceM: this.num(a.distance_m),
      elevationGainM: this.num(a.elevation_gain_m),
      avgSpeedMps: this.num(a.avg_speed_mps),
      avgHeartRate: a.avg_heart_rate,
      maxHeartRate: a.max_heart_rate,
      calories: a.calories,
      polyline: a.polyline,
      visibility: a.visibility,
      kudosCount: a.kudos_count,
      commentCount: a.comment_count,
    };
  }

  async list(
    member: CurrentMemberContext,
    opts: { limit?: number; before?: string; sport?: string } = {},
  ) {
    const take = Math.min(Math.max(opts.limit ?? MemberActivityService.PAGE, 1), 50);
    const rows = await this.pub.appUserActivity.findMany({
      where: {
        app_user_id: member.appUserId,
        ...(opts.sport && isSportKey(opts.sport) ? { sport_type: opts.sport } : {}),
        // Keyset pagination on started_at rather than an offset: an activity
        // recorded while the member is scrolling shifts every offset page by
        // one and silently duplicates a row.
        ...(opts.before ? { started_at: { lt: new Date(opts.before) } } : {}),
      },
      orderBy: { started_at: 'desc' },
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      activities: page.map((a) => this.toSummary(a)),
      nextBefore: hasMore ? page[page.length - 1].started_at.toISOString() : null,
    };
  }

  /**
   * Every route the member has recorded, thinned hard — the heatmap feed.
   *
   * Separate from `list` because the shapes and the numbers have opposite
   * needs: a list page wants twenty rows with everything on them, and a
   * heatmap wants hundreds of routes with nothing on them but geometry.
   * Sending full activity summaries for a year of running would be megabytes
   * to draw a picture that uses one field.
   *
   * Scoped to the token's appUserId and nothing else. This is the member's own
   * map of themselves — no privacy-zone trimming, because trimming exists to
   * hide a home address from OTHER people, and hiding it from its owner would
   * put a hole in the middle of their own heatmap for no benefit.
   */
  async routes(member: CurrentMemberContext, opts: { days?: number; sport?: string } = {}) {
    const days = Math.min(Math.max(opts.days ?? 365, 1), 1825);
    const rows = await this.pub.appUserActivity.findMany({
      where: {
        app_user_id: member.appUserId,
        started_at: { gte: new Date(Date.now() - days * 86_400_000) },
        polyline: { not: null },
        ...(opts.sport && isSportKey(opts.sport) ? { sport_type: opts.sport } : {}),
      },
      select: { id: true, sport_type: true, polyline: true, started_at: true },
      orderBy: { started_at: 'desc' },
      take: MemberActivityService.MAX_ROUTES,
    });

    const routes = rows
      .map((r) => {
        const points = decodePolyline(r.polyline ?? '');
        // A two-point stub draws as a straight line across the whole frame and
        // reads as a route somebody ran. Dropped rather than drawn.
        if (points.length < MemberActivityService.MIN_ROUTE_POINTS) return null;
        return {
          id: r.id,
          sportType: r.sport_type,
          startedAt: r.started_at.toISOString(),
          polyline: encodePolyline(thin(points, MemberActivityService.ROUTE_POINTS)),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return {
      routes,
      // Said out loud rather than silently truncating: a member with six years
      // of running should know the picture is not all of it.
      truncated: rows.length === MemberActivityService.MAX_ROUTES,
      days,
    };
  }

  async get(member: CurrentMemberContext, id: string) {
    const a = await this.pub.appUserActivity.findFirst({
      where: { id, app_user_id: member.appUserId },
      include: {
        streams: { select: { type: true, data: true, point_count: true } },
        laps: { orderBy: { lap_index: 'asc' } },
        photos: { select: { id: true, storage_path: true, is_primary: true } },
      },
    });
    // Not found and not yours are the same answer on purpose: a distinguishable
    // 403 would confirm that an id exists.
    if (!a) throw MemberException.notFound('Activity not found.');

    return {
      ...this.toSummary(a),
      description: a.description,
      elevationLossM: this.num(a.elevation_loss_m),
      maxSpeedMps: this.num(a.max_speed_mps),
      startLatitude: this.num(a.start_latitude),
      startLongitude: this.num(a.start_longitude),
      privacyZoneM: a.privacy_zone_m,
      /*
        Point COUNTS, not the data.

        This used to return every stream in full — up to 36,000 samples each,
        several megabytes — and the only thing any client did with it was count
        the points to render a label. The charts, splits and zones below are
        computed here from the same streams and are a few kilobytes. Anything
        that genuinely needs the raw series (GPX export) reads it server-side.
      */
      streams: Object.fromEntries(
        a.streams.map((s) => [s.type, Array.isArray(s.data) ? s.data.length : (s.point_count ?? 0)]),
      ),
      analysis: this.analyse(a.streams),
      laps: a.laps.map((l) => ({
        lapIndex: l.lap_index,
        elapsedSeconds: l.elapsed_seconds,
        movingSeconds: l.moving_seconds,
        distanceM: this.num(l.distance_m),
        avgHeartRate: l.avg_heart_rate,
        maxHeartRate: l.max_heart_rate,
      })),
      photos: a.photos.map((p) => ({ id: p.id, path: p.storage_path, primary: p.is_primary })),
    };
  }

  /**
   * Splits, heart-rate zones and a chart-sized series, from the raw streams.
   *
   * Zones use the default maximum and resting heart rate — the same ones the
   * `training/zones` endpoint assumes — because we do not store a measured
   * maximum per member yet. That makes the BAND EDGES an estimate; the time
   * spent between them is measured. The response says which is which so the
   * app can say so too.
   */
  private analyse(streams: { type: string; data: unknown }[]) {
    const by = Object.fromEntries(streams.map((s) => [s.type, s.data])) as Record<string, unknown>;

    const { zones, unreadSeconds } = zoneDistribution(
      by.heartrate,
      by.time,
      zoneBands(DEFAULT_HR_MAX, DEFAULT_HR_REST),
    );
    const anyHeartRate = zones.some((z) => z.seconds > 0);

    return {
      splits: splitsFrom(by.distance, by.time, {
        heartrate: by.heartrate,
        altitude: by.altitude,
      }),
      zones: anyHeartRate ? zones : [],
      zonesUnreadSeconds: unreadSeconds,
      /** True when the band edges came from an assumed maximum, not a measured one. */
      zonesEstimated: anyHeartRate,
      chart: chartSeries(by),
    };
  }

  async create(member: CurrentMemberContext, dto: ActivityCreateDto) {
    if (!isSportKey(dto.sportType)) {
      throw MemberException.badRequest(`Unknown sport type "${dto.sportType}".`);
    }
    const startedAt = new Date(dto.startedAt);
    if (Number.isNaN(startedAt.getTime())) {
      throw MemberException.badRequest('startedAt is not a valid date.');
    }
    // A workout finishing in the future is a clock problem on the device, and
    // storing it would put a card at the top of the feed forever.
    if (startedAt.getTime() > Date.now() + 60_000) {
      throw MemberException.badRequest('An activity cannot start in the future.');
    }

    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;
    if (endedAt && endedAt < startedAt) {
      throw MemberException.badRequest('An activity cannot end before it starts.');
    }

    const row = await this.pub.appUserActivity.create({
      data: {
        app_user_id: member.appUserId,
        sport_type: dto.sportType,
        title: dto.title ?? null,
        description: dto.description ?? null,
        source: dto.source ?? 'manual',
        started_at: startedAt,
        ended_at: endedAt,
        elapsed_seconds: dto.elapsedSeconds ?? 0,
        moving_seconds: dto.movingSeconds ?? null,
        distance_m: dto.distanceM ?? null,
        elevation_gain_m: dto.elevationGainM ?? null,
        elevation_loss_m: dto.elevationLossM ?? null,
        avg_speed_mps: dto.avgSpeedMps ?? null,
        max_speed_mps: dto.maxSpeedMps ?? null,
        avg_heart_rate: dto.avgHeartRate ?? null,
        max_heart_rate: dto.maxHeartRate ?? null,
        calories: dto.calories ?? null,
        polyline: dto.polyline ?? null,
        start_latitude: dto.startLatitude ?? null,
        start_longitude: dto.startLongitude ?? null,
        visibility: dto.visibility ?? 'followers',
      },
    });
    return this.toSummary(row);
  }

  async update(member: CurrentMemberContext, id: string, dto: ActivityUpdateDto) {
    if (dto.sportType && !isSportKey(dto.sportType)) {
      throw MemberException.badRequest(`Unknown sport type "${dto.sportType}".`);
    }
    // updateMany with the owner in the WHERE: a mismatched owner touches zero
    // rows instead of updating by id and checking afterwards.
    const res = await this.pub.appUserActivity.updateMany({
      where: { id, app_user_id: member.appUserId },
      data: {
        ...(dto.sportType !== undefined ? { sport_type: dto.sportType } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.privacyZoneM !== undefined ? { privacy_zone_m: dto.privacyZoneM } : {}),
      },
    });
    if (res.count === 0) throw MemberException.notFound('Activity not found.');
    return this.get(member, id);
  }

  async remove(member: CurrentMemberContext, id: string) {
    const res = await this.pub.appUserActivity.deleteMany({
      where: { id, app_user_id: member.appUserId },
    });
    if (res.count === 0) throw MemberException.notFound('Activity not found.');
    // Streams, laps and photos go with it — every child cascades on the FK.
    return { deleted: true };
  }

  /**
   * Attach or replace the recorded series for one activity.
   *
   * Upsert per type rather than append, so a resumed or retried upload replaces
   * that series instead of leaving a ride stored twice. That is what makes the
   * upload safe to retry on a gym's connection, which is the whole reason the
   * unique (activity_id, type) constraint exists.
   */
  async putStreams(member: CurrentMemberContext, id: string, dto: ActivityStreamsDto) {
    const owned = await this.pub.appUserActivity.findFirst({
      where: { id, app_user_id: member.appUserId },
      select: { id: true },
    });
    if (!owned) throw MemberException.notFound('Activity not found.');

    const written: string[] = [];
    for (const [type, data] of Object.entries(dto.streams ?? {})) {
      if (!MemberActivityService.STREAM_TYPES.has(type)) {
        throw MemberException.badRequest(`Unknown stream type "${type}".`);
      }
      if (!Array.isArray(data)) {
        throw MemberException.badRequest(`Stream "${type}" must be an array.`);
      }
      if (data.length > MemberActivityService.MAX_POINTS) {
        throw MemberException.badRequest(
          `Stream "${type}" has ${data.length} points; the limit is ${MemberActivityService.MAX_POINTS}.`,
        );
      }
      await this.pub.appUserActivityStream.upsert({
        where: { activity_id_type: { activity_id: id, type } },
        create: {
          activity_id: id,
          type,
          data: data as Prisma.InputJsonValue,
          point_count: data.length,
        },
        update: { data: data as Prisma.InputJsonValue, point_count: data.length },
      });
      written.push(type);
    }

    if (dto.laps?.length) {
      await this.pub.appUserActivityLap.deleteMany({ where: { activity_id: id } });
      await this.pub.appUserActivityLap.createMany({
        data: dto.laps.map((l, i) => ({
          activity_id: id,
          lap_index: l.lapIndex ?? i,
          elapsed_seconds: l.elapsedSeconds ?? 0,
          moving_seconds: l.movingSeconds ?? null,
          distance_m: l.distanceM ?? null,
          avg_heart_rate: l.avgHeartRate ?? null,
          max_heart_rate: l.maxHeartRate ?? null,
        })),
      });
    }

    return { streams: written, laps: dto.laps?.length ?? 0 };
  }
}

/** Every nth point, always keeping the last so a route never loses its end. */
function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = points.filter((_, i) => i % step === 0);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
