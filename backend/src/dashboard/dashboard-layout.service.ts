import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';

/**
 * Wave 14 — Dashboard Personalization.
 *
 * Persists per-user dashboard layouts (visible tiles, size, order). The Pulse
 * Strip and Action Stack are always rendered; only the working-canvas tiles
 * are personalizable. Unknown tile ids in saved layouts are filtered on read.
 *
 * The first time the app boots after the migration is added but before it has
 * been applied, every read/write will hit Prisma error code P2021 (table
 * doesn't exist). We translate that into "use the role default layout" so
 * the dashboard never crashes — every other Prisma error rethrows.
 */

export type LayoutRole = 'owner' | 'manager' | 'trainer' | 'front_desk';

export interface LayoutTile {
  id: string;
  visible: boolean;
  size: 1 | 2 | 3;
  order: number;
}

export interface DashboardLayout {
  tiles: LayoutTile[];
  version: number;
  is_default: boolean;
}

const KNOWN_TILE_IDS = [
  'revenue_trend',
  'recent_activity',
  'occupancy_gauge',
  'todays_classes',
  'revenue_mix',
  'payment_methods',
  'revenue_summary',
  'retention_curve',
  'segments',
  'business_metrics',
  'footfall_heatmap',
  'inventory',
  'trainer_leaderboard',
] as const;

const DEFAULT_LAYOUTS: Record<LayoutRole, LayoutTile[]> = {
  owner: KNOWN_TILE_IDS.map((id, i) => ({ id, visible: true, size: 2, order: i })),
  manager: KNOWN_TILE_IDS
    .filter((id) => id !== 'business_metrics')
    .map((id, i) => ({ id, visible: true, size: 2, order: i })),
  trainer: [
    { id: 'todays_classes', visible: true, size: 3, order: 0 },
    { id: 'occupancy_gauge', visible: true, size: 1, order: 1 },
    { id: 'recent_activity', visible: true, size: 2, order: 2 },
  ],
  front_desk: [
    { id: 'todays_classes', visible: true, size: 2, order: 0 },
    { id: 'occupancy_gauge', visible: true, size: 1, order: 1 },
    { id: 'recent_activity', visible: true, size: 3, order: 2 },
  ],
};

function resolveRole(user: JwtPayload): LayoutRole {
  const role = (user?.role || 'manager').toLowerCase();
  if (role === 'owner' || role === 'manager' || role === 'trainer' || role === 'front_desk') {
    return role as LayoutRole;
  }
  return 'manager';
}

/** Prisma error code raised when the table doesn't exist yet (pre-migration). */
const TABLE_MISSING = 'P2021';

@Injectable()
export class DashboardLayoutService {
  private readonly logger = new Logger(DashboardLayoutService.name);

  constructor(private prisma: PrismaService) {}

  async getLayout(user: JwtPayload): Promise<DashboardLayout> {
    const role = resolveRole(user);
    try {
      const row = await this.prisma.userDashboardLayout.findUnique({
        where: {
          user_id_studio_id_role: {
            user_id: user.user_id,
            studio_id: user.studio_id,
            role,
          },
        },
      });
      if (row) {
        const tiles = this.sanitize(row.layout_json as { tiles?: LayoutTile[] });
        return { tiles, version: row.version, is_default: false };
      }
    } catch (err) {
      if (this.isTableMissing(err)) {
        this.logger.warn('user_dashboard_layouts table missing — run prisma migrate');
      } else {
        throw err;
      }
    }
    return { tiles: DEFAULT_LAYOUTS[role], version: 1, is_default: true };
  }

  async saveLayout(user: JwtPayload, tiles: LayoutTile[]): Promise<{ ok: true }> {
    if (!Array.isArray(tiles)) throw new BadRequestException('tiles must be an array');
    const sanitized = this.sanitize({ tiles });
    const role = resolveRole(user);
    try {
      await this.prisma.userDashboardLayout.upsert({
        where: {
          user_id_studio_id_role: {
            user_id: user.user_id,
            studio_id: user.studio_id,
            role,
          },
        },
        create: {
          user_id: user.user_id,
          studio_id: user.studio_id,
          role,
          layout_json: { tiles: sanitized } as unknown as Prisma.InputJsonValue,
        },
        update: {
          layout_json: { tiles: sanitized } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (this.isTableMissing(err)) {
        throw new BadRequestException(
          'Layout persistence not yet available — apply Wave 14 migration first',
        );
      }
      throw err;
    }
    return { ok: true };
  }

  async resetLayout(user: JwtPayload): Promise<{ ok: true }> {
    const role = resolveRole(user);
    try {
      await this.prisma.userDashboardLayout.deleteMany({
        where: {
          user_id: user.user_id,
          studio_id: user.studio_id,
          role,
        },
      });
    } catch (err) {
      if (!this.isTableMissing(err)) throw err;
    }
    return { ok: true };
  }

  private isTableMissing(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === TABLE_MISSING
    );
  }

  private sanitize(input: { tiles?: LayoutTile[] }): LayoutTile[] {
    const valid = new Set<string>(KNOWN_TILE_IDS as readonly string[]);
    const seen = new Set<string>();
    const tiles = (input?.tiles ?? [])
      .filter(
        (t) =>
          t &&
          typeof t.id === 'string' &&
          valid.has(t.id) &&
          !seen.has(t.id) &&
          (seen.add(t.id), true),
      )
      .map((t, i) => ({
        id: t.id,
        visible: !!t.visible,
        size: ([1, 2, 3].includes(t.size as number) ? t.size : 2) as 1 | 2 | 3,
        order: typeof t.order === 'number' ? t.order : i,
      }))
      .sort((a, b) => a.order - b.order);
    return tiles;
  }
}
