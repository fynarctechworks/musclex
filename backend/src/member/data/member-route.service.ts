import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { decodePolyline, metresBetween } from './polyline';
import { parseGpx, polylineFor, toGpx, MAX_POINTS } from './gpx';
import { isSportKey } from './sport-types';
import type { RouteCreateDto, RouteImportDto } from './dto';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER ROUTE SERVICE — saved routes
 * ────────────────────────────────────────────────────────────────
 *
 * `public` / app_user scoped, like activities: a route belongs to the person,
 * not to whichever gym they happen to be at.
 *
 * TWO COPIES OF THE LINE, deliberately. The geography column is what spatial
 * questions are asked of; the encoded polyline is what a list of twenty routes
 * draws. Writing both once beats decoding on every read or making a PostGIS
 * call per row.
 *
 * VISIBILITY DEFAULTS TO only_me. A saved route usually starts at somebody's
 * front door, exactly like an activity, so it gets the same default.
 */
@Injectable()
export class MemberRouteService {
  private static readonly PAGE = 50;
  /** Ten kilometres is the widest "near me" that still means near. */
  private static readonly MAX_RADIUS_M = 10_000;

  constructor(private readonly pub: PublicPrismaService) {}

  private toRoute(r: any) {
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      sportType: r.sport_type ?? null,
      source: r.source,
      polyline: r.polyline ?? null,
      distanceM: r.distance_m == null ? null : Number(r.distance_m),
      elevationGainM: r.elevation_gain_m == null ? null : Number(r.elevation_gain_m),
      visibility: r.visibility,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    };
  }

  async list(member: CurrentMemberContext) {
    const rows = await this.pub.route.findMany({
      where: { app_user_id: member.appUserId },
      orderBy: { created_at: 'desc' },
      take: MemberRouteService.PAGE,
    });
    return { routes: rows.map((r) => this.toRoute(r)) };
  }

  async get(member: CurrentMemberContext, id: string) {
    const r = await this.pub.route.findFirst({
      where: {
        id,
        // Somebody else's route is readable only if they made it public.
        OR: [{ app_user_id: member.appUserId }, { visibility: 'everyone' }],
      },
    });
    if (!r) throw MemberException.notFound('Route not found.');
    return { ...this.toRoute(r), mine: r.app_user_id === member.appUserId };
  }

  /**
   * Write the row, including both copies of the line.
   *
   * Raw SQL because `path` and `start_point` are PostGIS geography columns,
   * which Prisma cannot express. No gym_id filter applies: `routes` is a
   * `public` table with no tenant column.
   */
  private async insert(
    appUserId: string,
    fields: {
      name: string;
      description?: string | null;
      sportType?: string | null;
      source: string;
      visibility: string;
      points: { lat: number; lng: number }[];
      distanceM: number;
      elevationGainM: number;
    },
  ) {
    const { points } = fields;
    // WKT wants "lon lat", which is the reverse of how every other part of
    // this codebase writes a coordinate. Getting it backwards puts Indian
    // routes in Antarctica, so it is built in exactly one place: here.
    const wkt = `LINESTRING(${points.map((p) => `${p.lng} ${p.lat}`).join(',')})`;
    const startWkt = `POINT(${points[0].lng} ${points[0].lat})`;

    const rows = await this.pub.$queryRaw<any[]>`
      INSERT INTO public.routes
        (app_user_id, name, description, sport_type, source, visibility,
         path, start_point, polyline, distance_m, elevation_gain_m)
      VALUES (
        ${appUserId}::uuid, ${fields.name}, ${fields.description ?? null},
        ${fields.sportType ?? null}, ${fields.source}, ${fields.visibility},
        ST_GeogFromText(${wkt}), ST_GeogFromText(${startWkt}),
        ${polylineFor(points)}, ${fields.distanceM}, ${fields.elevationGainM}
      )
      RETURNING id, name, description, sport_type, source, polyline,
                distance_m, elevation_gain_m, visibility, created_at, app_user_id
    `;
    return rows[0];
  }

  private validate(points: { lat: number; lng: number }[]) {
    if (points.length < 2) {
      throw MemberException.badRequest('A route needs at least two points.');
    }
    if (points.length > MAX_POINTS) {
      throw MemberException.badRequest(`A route can hold at most ${MAX_POINTS} points.`);
    }
    for (const p of points) {
      if (
        !Number.isFinite(p.lat) || !Number.isFinite(p.lng) ||
        p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180
      ) {
        throw MemberException.badRequest('A point is not a real coordinate.');
      }
    }
  }

  private measure(points: { lat: number; lng: number }[]) {
    let d = 0;
    for (let i = 1; i < points.length; i++) d += metresBetween(points[i - 1], points[i]);
    return Math.round(d * 100) / 100;
  }

  async create(member: CurrentMemberContext, dto: RouteCreateDto) {
    if (dto.sportType && !isSportKey(dto.sportType)) {
      throw MemberException.badRequest(`Unknown sport type "${dto.sportType}".`);
    }
    const points = dto.polyline
      ? decodePolyline(dto.polyline)
      : (dto.points ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
    this.validate(points);

    const row = await this.insert(member.appUserId, {
      name: dto.name.trim(),
      description: dto.description ?? null,
      sportType: dto.sportType ?? null,
      source: 'drawn',
      visibility: dto.visibility ?? 'only_me',
      points,
      distanceM: this.measure(points),
      elevationGainM: 0,
    });
    return { ...this.toRoute(row), mine: true };
  }

  /** Import a GPX file exported from anywhere else. */
  async importGpx(member: CurrentMemberContext, dto: RouteImportDto) {
    const parsed = parseGpx(dto.gpx);
    this.validate(parsed.points);

    const row = await this.insert(member.appUserId, {
      // The file's own name unless the member gave one; "Untitled" is a
      // worse answer than whatever their other app called it.
      name: (dto.name ?? parsed.name ?? 'Imported route').trim().slice(0, 120),
      sportType: dto.sportType && isSportKey(dto.sportType) ? dto.sportType : null,
      source: 'gpx',
      visibility: 'only_me',
      points: parsed.points,
      distanceM: parsed.distanceM,
      elevationGainM: parsed.elevationGainM,
    });
    return { ...this.toRoute(row), mine: true, importedPoints: parsed.points.length };
  }

  /** The route as a GPX file, so it can leave again. */
  async exportGpx(member: CurrentMemberContext, id: string): Promise<string> {
    const r = await this.get(member, id);
    if (!r.polyline) throw MemberException.badRequest('That route has no line to export.');
    return toGpx({
      name: r.name,
      points: decodePolyline(r.polyline).map((p) => ({ ...p, ele: null })),
    });
  }

  async remove(member: CurrentMemberContext, id: string) {
    const res = await this.pub.route.deleteMany({
      where: { id, app_user_id: member.appUserId },
    });
    if (res.count === 0) throw MemberException.notFound('Route not found.');
    return { deleted: true };
  }

  /**
   * Routes starting near a point.
   *
   * ST_DWithin against the GIST index on `start_point`, which is why PostGIS
   * was enabled: the alternative is fetching every route and measuring them in
   * Node, which works at ten routes and not at ten thousand.
   *
   * Returns the member's own routes plus anything published — never somebody
   * else's private route, which would give away where they live.
   */
  async near(
    member: CurrentMemberContext,
    lat: number,
    lng: number,
    radiusM = 5000,
    sport?: string,
  ) {
    if (
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      throw MemberException.badRequest('That is not a real position.');
    }
    const radius = Math.min(Math.max(radiusM, 100), MemberRouteService.MAX_RADIUS_M);
    const sportFilter = sport && isSportKey(sport) ? sport : null;

    const rows = await this.pub.$queryRaw<any[]>`
      SELECT id, name, description, sport_type, source, polyline,
             distance_m, elevation_gain_m, visibility, created_at, app_user_id,
             ROUND(ST_Distance(start_point, ST_MakePoint(${lng}, ${lat})::geography)::numeric, 0) AS away_m
        FROM public.routes
       WHERE start_point IS NOT NULL
         AND ST_DWithin(start_point, ST_MakePoint(${lng}, ${lat})::geography, ${radius})
         AND (app_user_id = ${member.appUserId}::uuid OR visibility = 'everyone')
         AND (${sportFilter}::text IS NULL OR sport_type = ${sportFilter})
       ORDER BY away_m ASC
       LIMIT 50
    `;
    return {
      routes: rows.map((r) => ({
        ...this.toRoute(r),
        mine: r.app_user_id === member.appUserId,
        awayM: Number(r.away_m),
      })),
    };
  }
}
