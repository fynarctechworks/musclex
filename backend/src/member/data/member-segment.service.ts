import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { decodePolyline, metresBetween } from './polyline';
import { polylineFor } from './gpx';
import { isSportKey } from './sport-types';
import { matchSegment, trackFromStreams, MATCH_TOLERANCE_M } from './segment-match';
import type { SegmentCreateDto } from './dto';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER SEGMENT SERVICE — named stretches, and the times on them
 * ────────────────────────────────────────────────────────────────
 *
 * NARROW IN THE DATABASE, DECIDE IN CODE. PostGIS finds the handful of
 * segments whose start lies anywhere near an activity — a GIST index lookup,
 * not a scan — and segment-match.ts then verifies each candidate against the
 * actual track. The half that decides whether somebody gets a time is
 * therefore unit-tested against exact tracks rather than against a live index.
 *
 * All `public` / app_user scoped: no gym_id, no studio schema.
 */
@Injectable()
export class MemberSegmentService {
  private readonly log = new Logger(MemberSegmentService.name);

  /** How far from the track a segment's start may be to be worth verifying. */
  private static readonly CANDIDATE_RADIUS_M = 60;
  /** A cap on candidates per activity, so one busy city cannot stall an upload. */
  private static readonly MAX_CANDIDATES = 50;

  constructor(private readonly pub: PublicPrismaService) {}

  private toSegment(s: any) {
    return {
      id: s.id,
      name: s.name,
      sportType: s.sport_type ?? null,
      polyline: s.polyline ?? null,
      distanceM: Number(s.distance_m),
      elevationGainM: s.elevation_gain_m == null ? null : Number(s.elevation_gain_m),
      effortCount: s.effort_count,
    };
  }

  /**
   * Create a segment from part of an activity the member did.
   *
   * Cut from a real ride rather than drawn freehand: a segment nobody has
   * ridden cannot be verified as rideable, and its leaderboard would open
   * empty with no way to know whether that is because it is hard or because it
   * crosses a motorway.
   */
  async create(member: CurrentMemberContext, dto: SegmentCreateDto) {
    if (dto.sportType && !isSportKey(dto.sportType)) {
      throw MemberException.badRequest(`Unknown sport type "${dto.sportType}".`);
    }

    const activity = await this.pub.appUserActivity.findFirst({
      where: { id: dto.activityId, app_user_id: member.appUserId },
      include: { streams: { where: { type: { in: ['latlng', 'time'] } } } },
    });
    if (!activity) throw MemberException.notFound('Activity not found.');

    const byType = new Map(activity.streams.map((s) => [s.type, s.data]));
    const track = trackFromStreams(byType.get('latlng'), byType.get('time'));
    if (track.length < 2) {
      throw MemberException.badRequest('That activity has no recorded track.');
    }

    const from = Math.max(0, Math.min(dto.startIndex, track.length - 1));
    const to = Math.max(0, Math.min(dto.endIndex, track.length - 1));
    if (to <= from) {
      throw MemberException.badRequest('The segment must end after it starts.');
    }

    const points = track.slice(from, to + 1);
    let distance = 0;
    for (let i = 1; i < points.length; i++) distance += metresBetween(points[i - 1], points[i]);
    // Matches the CHECK on the column; said here so the member gets a reason
    // rather than a constraint violation.
    if (distance < 50) throw MemberException.badRequest('A segment must be at least 50 m long.');
    if (distance > 100_000) throw MemberException.badRequest('A segment cannot exceed 100 km.');

    const wkt = `LINESTRING(${points.map((p) => `${p.lng} ${p.lat}`).join(',')})`;
    const rows = await this.pub.$queryRaw<any[]>`
      INSERT INTO public.segments
        (created_by, name, sport_type, path, start_point, end_point,
         polyline, distance_m)
      VALUES (
        ${member.appUserId}::uuid, ${dto.name.trim()}, ${dto.sportType ?? null},
        ST_GeogFromText(${wkt}),
        ST_GeogFromText(${`POINT(${points[0].lng} ${points[0].lat})`}),
        ST_GeogFromText(${`POINT(${points[points.length - 1].lng} ${points[points.length - 1].lat})`}),
        ${polylineFor(points)}, ${Math.round(distance * 100) / 100}
      )
      RETURNING id, name, sport_type, polyline, distance_m, elevation_gain_m, effort_count
    `;
    const segment = rows[0];

    // The activity it was cut from is by definition an effort on it.
    await this.matchActivity(member, dto.activityId);
    return this.toSegment(segment);
  }

  /**
   * Find every segment this activity rode, and record the efforts.
   *
   * Called after an upload. Idempotent: re-running produces the same efforts
   * because they are unique on (segment, activity).
   */
  async matchActivity(member: CurrentMemberContext, activityId: string) {
    const activity = await this.pub.appUserActivity.findFirst({
      where: { id: activityId, app_user_id: member.appUserId },
      include: { streams: { where: { type: { in: ['latlng', 'time'] } } } },
    });
    if (!activity) throw MemberException.notFound('Activity not found.');

    const byType = new Map(activity.streams.map((s) => [s.type, s.data]));
    const track = trackFromStreams(byType.get('latlng'), byType.get('time'));
    if (track.length < 2) return { matched: 0, efforts: [] };

    // NARROW: segments whose start is near ANY point of this track. The
    // track is handed to PostGIS as a line so this is one indexed query
    // rather than one per point.
    const wkt = `LINESTRING(${track.map((p) => `${p.lng} ${p.lat}`).join(',')})`;
    const candidates = await this.pub.$queryRaw<any[]>`
      SELECT id, name, distance_m,
             ST_Y(start_point::geometry) AS start_lat,
             ST_X(start_point::geometry) AS start_lng,
             ST_Y(end_point::geometry)   AS end_lat,
             ST_X(end_point::geometry)   AS end_lng
        FROM public.segments
       WHERE ST_DWithin(start_point, ST_GeogFromText(${wkt}), ${MemberSegmentService.CANDIDATE_RADIUS_M})
         AND (sport_type IS NULL OR sport_type = ${activity.sport_type})
       LIMIT ${MemberSegmentService.MAX_CANDIDATES}
    `;

    const efforts: { segmentId: string; name: string; elapsedSeconds: number }[] = [];
    for (const c of candidates) {
      // DECIDE: being near the start proves nothing. This is the tested part.
      const effort = matchSegment(track, {
        start: { lat: Number(c.start_lat), lng: Number(c.start_lng) },
        end: { lat: Number(c.end_lat), lng: Number(c.end_lng) },
        distanceM: Number(c.distance_m),
      });
      if (!effort) continue;

      const existing = await this.pub.segmentEffort.findFirst({
        where: { segment_id: c.id, activity_id: activityId },
        select: { id: true },
      });
      if (!existing) {
        await this.pub.segmentEffort.create({
          data: {
            segment_id: c.id,
            activity_id: activityId,
            app_user_id: member.appUserId,
            elapsed_seconds: effort.elapsedSeconds,
            started_at: activity.started_at,
          },
        });
        await this.pub.segment.update({
          where: { id: c.id },
          data: { effort_count: { increment: 1 } },
        });
      }
      efforts.push({ segmentId: c.id, name: c.name, elapsedSeconds: effort.elapsedSeconds });
    }

    this.log.log(
      `activity ${activityId}: ${candidates.length} candidates, ${efforts.length} matched`,
    );
    return { matched: efforts.length, efforts };
  }

  /**
   * A segment and its leaderboard.
   *
   * One row per PERSON — their best — not one per effort. A board listing
   * somebody's twelve attempts is a log, not a ranking.
   */
  async get(member: CurrentMemberContext, segmentId: string) {
    const s = await this.pub.segment.findUnique({ where: { id: segmentId } });
    if (!s) throw MemberException.notFound('Segment not found.');

    const rows = await this.pub.$queryRaw<any[]>`
      SELECT DISTINCT ON (e.app_user_id)
             e.app_user_id, e.elapsed_seconds, e.started_at, u.full_name
        FROM public.segment_efforts e
        JOIN public.app_users u ON u.id = e.app_user_id
       WHERE e.segment_id = ${segmentId}::uuid
       ORDER BY e.app_user_id, e.elapsed_seconds ASC
    `;
    const board = rows
      .map((r) => ({
        id: r.app_user_id,
        name: r.full_name,
        elapsedSeconds: r.elapsed_seconds,
        at: r.started_at.toISOString(),
        mine: r.app_user_id === member.appUserId,
      }))
      .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const starred = await this.pub.segmentStar.findFirst({
      where: { segment_id: segmentId, app_user_id: member.appUserId },
      select: { id: true },
    });

    return { ...this.toSegment(s), leaderboard: board, starred: !!starred };
  }

  /** Segments starting near a point — what the map asks for. */
  async near(member: CurrentMemberContext, lat: number, lng: number, radiusM = 5000) {
    if (
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      throw MemberException.badRequest('That is not a real position.');
    }
    const radius = Math.min(Math.max(radiusM, 100), 25_000);
    const rows = await this.pub.$queryRaw<any[]>`
      SELECT id, name, sport_type, polyline, distance_m, elevation_gain_m, effort_count,
             ROUND(ST_Distance(start_point, ST_MakePoint(${lng}, ${lat})::geography)::numeric, 0) AS away_m
        FROM public.segments
       WHERE ST_DWithin(start_point, ST_MakePoint(${lng}, ${lat})::geography, ${radius})
       ORDER BY away_m ASC
       LIMIT 50
    `;
    return {
      segments: rows.map((r) => ({ ...this.toSegment(r), awayM: Number(r.away_m) })),
    };
  }

  async toggleStar(member: CurrentMemberContext, segmentId: string) {
    const existing = await this.pub.segmentStar.findFirst({
      where: { segment_id: segmentId, app_user_id: member.appUserId },
      select: { id: true },
    });
    if (existing) {
      await this.pub.segmentStar.delete({ where: { id: existing.id } });
      return { starred: false };
    }
    const s = await this.pub.segment.findUnique({ where: { id: segmentId }, select: { id: true } });
    if (!s) throw MemberException.notFound('Segment not found.');
    await this.pub.segmentStar.create({
      data: { segment_id: segmentId, app_user_id: member.appUserId },
    });
    return { starred: true };
  }

  async starred(member: CurrentMemberContext) {
    const rows = await this.pub.segmentStar.findMany({
      where: { app_user_id: member.appUserId },
      include: { segment: true },
      orderBy: { created_at: 'desc' },
    });
    return { segments: rows.map((r) => this.toSegment(r.segment)) };
  }
}
