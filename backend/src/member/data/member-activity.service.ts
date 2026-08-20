import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../node_modules/.prisma/client-public';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { isSportKey, SPORT_TYPES } from './sport-types';
import type { ActivityCreateDto, ActivityStreamsDto, ActivityUpdateDto } from './dto';

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
      streams: Object.fromEntries(a.streams.map((s) => [s.type, s.data])),
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
