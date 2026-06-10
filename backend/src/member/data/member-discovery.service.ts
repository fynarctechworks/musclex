import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberException } from '../common/member-exception';
import type { NearbyGymsData, GymProfileData } from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER DISCOVERY SERVICE (Phase 5 — conversion engine)
 * ────────────────────────────────────────────────────────────────
 *
 * The public gym directory: lists active gyms' branches across ALL tenants so a
 * gym-less PUBLIC user can find a gym to join (the core conversion surface). This
 * is deliberately cross-tenant (like member_directory) — but exposes ONLY
 * public-safe gym/branch fields (name, address, city, lat/lng, phone, logo);
 * never any member or operational data. Uses raw SQL across studio_template.
 * branches ⋈ public.studios; gym_id is irrelevant here (it's a directory).
 */
@Injectable()
export class MemberDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async nearbyGyms(
    lat?: number,
    lng?: number,
    q?: string,
  ): Promise<NearbyGymsData> {
    const hasGeo =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng);

    // Haversine (km) when coordinates are supplied, else NULL.
    const distanceSql = hasGeo
      ? Prisma.sql`(6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians(${lat})) * cos(radians(b.latitude)) *
            cos(radians(b.longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(b.latitude))
          ))))`
      : Prisma.sql`NULL::float`;

    const search = q
      ? Prisma.sql`AND (b.name ILIKE ${`%${q}%`} OR b.city ILIKE ${`%${q}%`} OR s.name ILIKE ${`%${q}%`})`
      : Prisma.empty;

    // Nearest-first when geo present (NULLS LAST so coord-less branches trail),
    // else alphabetical by city then gym.
    const orderSql = hasGeo
      ? Prisma.sql`ORDER BY distance_km ASC NULLS LAST, gym_name ASC`
      : Prisma.sql`ORDER BY city ASC NULLS LAST, gym_name ASC`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        tenant_id: string;
        gym_name: string;
        logo_url: string | null;
        branch_id: string;
        branch_name: string;
        address: string | null;
        city: string | null;
        latitude: number | null;
        longitude: number | null;
        phone: string | null;
        distance_km: number | null;
      }>
    >(Prisma.sql`
      SELECT
        s.id::text        AS tenant_id,
        s.name            AS gym_name,
        s.logo_url        AS logo_url,
        b.id::text        AS branch_id,
        b.name            AS branch_name,
        b.address         AS address,
        b.city            AS city,
        b.latitude::float AS latitude,
        b.longitude::float AS longitude,
        b.phone           AS phone,
        ${distanceSql}    AS distance_km
      FROM studio_template.branches b
      JOIN public.studios s ON s.id = b.gym_id
      WHERE b.status = 'active'
        AND s.lifecycle_status IN ('active', 'grace_period')
        ${search}
      ${orderSql}
      LIMIT 50
    `);

    return {
      gyms: rows.map((r) => ({
        tenantId: r.tenant_id,
        gymName: r.gym_name,
        logoUrl: r.logo_url,
        branchId: r.branch_id,
        branchName: r.branch_name,
        address: r.address,
        city: r.city,
        latitude: r.latitude,
        longitude: r.longitude,
        phone: r.phone,
        distanceKm:
          r.distance_km != null ? Math.round(r.distance_km * 10) / 10 : null,
      })),
    };
  }

  /**
   * Public gym profile page (Phase 7.5): a single gym's public-safe info —
   * identity, branches, and membership plans — for the conversion surface. Reads
   * cross-tenant by an explicit tenant id; exposes no member/operational data.
   */
  async gymProfile(tenantId: string): Promise<GymProfileData> {
    const [studio] = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; tagline: string | null; logo_url: string | null; city: string | null }>
    >(Prisma.sql`
      SELECT id::text AS id, name, tagline, logo_url, city
      FROM public.studios
      WHERE id = ${tenantId}::uuid
        AND lifecycle_status IN ('active', 'grace_period')
      LIMIT 1
    `);
    if (!studio) throw MemberException.notFound('Gym not found.');

    const branches = await this.prisma.$queryRaw<
      Array<{
        branch_id: string; branch_name: string; address: string | null;
        city: string | null; latitude: number | null; longitude: number | null; phone: string | null;
      }>
    >(Prisma.sql`
      SELECT id::text AS branch_id, name AS branch_name, address, city,
             latitude::float AS latitude, longitude::float AS longitude, phone
      FROM studio_template.branches
      WHERE gym_id = ${tenantId}::uuid AND status = 'active'
      ORDER BY name ASC
    `);

    const plans = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; price: number | null; duration_days: number | null; description: string | null }>
    >(Prisma.sql`
      SELECT id::text AS id, name, price::float AS price,
             duration_days, description
      FROM studio_template.membership_plans
      WHERE gym_id = ${tenantId}::uuid AND is_active = true
      ORDER BY price ASC NULLS LAST
      LIMIT 20
    `);

    return {
      tenantId: studio.id,
      gymName: studio.name,
      tagline: studio.tagline,
      logoUrl: studio.logo_url,
      city: studio.city,
      branches: branches.map((b) => ({
        tenantId: studio.id,
        gymName: studio.name,
        logoUrl: studio.logo_url,
        branchId: b.branch_id,
        branchName: b.branch_name,
        address: b.address,
        city: b.city,
        latitude: b.latitude,
        longitude: b.longitude,
        phone: b.phone,
        distanceKm: null,
      })),
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        durationDays: p.duration_days,
        description: p.description,
      })),
    };
  }
}
