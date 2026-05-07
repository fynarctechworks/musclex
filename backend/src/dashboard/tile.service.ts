import { Injectable, Logger } from '@nestjs/common';
import { JwtPayload } from '../common';

/**
 * Dashboard role views — surfaces tiles per role.
 * Mirrors the role-view variants enumerated in the dashboard upgrade plan
 * (owner / manager / trainer / front_desk / mobile).
 */
export type DashboardRoleView = 'owner' | 'manager' | 'trainer' | 'front_desk' | 'mobile';

/** Size in 12-col grid units (1 = third, 2 = two-thirds, 3 = full width). */
export type TileSize = 1 | 2 | 3;

export interface TileDefinition {
  /** Stable id used by the frontend tile registry & layout persistence. */
  id: string;
  /** Display label rendered in the tile header. */
  label: string;
  /** Capability flags the user must have for this tile (any-of). Empty array = no gating. */
  capabilities: string[];
  /** Default span when first rendered (1, 2, or 3 columns out of 3). */
  default_size: TileSize;
  /** Whether the tile is shown by default before user customisation. */
  default_visible: boolean;
  /** Roles that may see the tile at all (server-enforced visibility matrix). */
  role_visibility: DashboardRoleView[];
}

/**
 * The canonical tile registry. Future waves register new tiles here so that:
 *   1. The backend gates visibility per role/capability before serving payload.
 *   2. The frontend can request the registry once and render only the tiles
 *      the current user is allowed to see.
 *
 * Each entry is **metadata only** — rendering and data-fetching live elsewhere.
 */
const TILE_REGISTRY: TileDefinition[] = [
  {
    id: 'revenue_trend',
    label: 'Revenue Trend',
    capabilities: ['payments.view'],
    default_size: 2,
    default_visible: true,
    role_visibility: ['owner', 'manager'],
  },
  {
    id: 'recent_activity',
    label: 'Recent Activity',
    capabilities: ['dashboard.view'],
    default_size: 1,
    default_visible: true,
    role_visibility: ['owner', 'manager', 'front_desk', 'trainer'],
  },
  {
    id: 'occupancy_gauge',
    label: 'In-Gym Occupancy',
    capabilities: ['check_ins.view'],
    default_size: 1,
    default_visible: true,
    role_visibility: ['owner', 'manager', 'front_desk'],
  },
  {
    id: 'todays_classes',
    label: "Today's Classes",
    capabilities: ['classes.view'],
    default_size: 1,
    default_visible: true,
    role_visibility: ['owner', 'manager', 'front_desk', 'trainer'],
  },
  {
    id: 'revenue_mix',
    label: 'Revenue Mix',
    capabilities: ['payments.view'],
    default_size: 1,
    default_visible: true,
    role_visibility: ['owner', 'manager'],
  },
  {
    id: 'payment_methods',
    label: 'Payment Methods',
    capabilities: ['payments.view'],
    default_size: 1,
    default_visible: false,
    role_visibility: ['owner', 'manager'],
  },
  {
    id: 'retention_curve',
    label: 'Retention Curve',
    capabilities: ['analytics.view'],
    default_size: 2,
    default_visible: false,
    role_visibility: ['owner'],
  },
  {
    id: 'segments',
    label: 'Member Segments',
    capabilities: ['members.view'],
    default_size: 1,
    default_visible: false,
    role_visibility: ['owner', 'manager'],
  },
  {
    id: 'footfall_heatmap',
    label: 'Footfall Heatmap',
    capabilities: ['check_ins.view'],
    default_size: 2,
    default_visible: false,
    role_visibility: ['owner', 'manager'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    capabilities: ['inventory.view'],
    default_size: 1,
    default_visible: false,
    role_visibility: ['owner', 'manager'],
  },
  {
    id: 'trainer_leaderboard',
    label: 'Trainer Leaderboard',
    capabilities: ['staff.view'],
    default_size: 1,
    default_visible: false,
    role_visibility: ['owner', 'manager'],
  },
];

@Injectable()
export class TileService {
  private readonly logger = new Logger(TileService.name);

  /**
   * Returns the registry filtered by the caller's role and capabilities.
   * Owners always see everything (capabilities are auto-granted).
   */
  listTiles(user: JwtPayload | undefined): TileDefinition[] {
    const role = this.resolveRoleView(user);
    const userCapabilities = this.resolveCapabilities(user);

    return TILE_REGISTRY.filter((tile) => {
      if (!tile.role_visibility.includes(role)) return false;
      if (tile.capabilities.length === 0) return true;
      // Owners see everything; otherwise require any-of capability match.
      if (this.isOwnerLike(user)) return true;
      return tile.capabilities.some((cap) => userCapabilities.has(cap));
    });
  }

  /** Returns the full registry (un-filtered) — used by tests and admin views. */
  getRegistry(): TileDefinition[] {
    return [...TILE_REGISTRY];
  }

  private resolveRoleView(user: JwtPayload | undefined): DashboardRoleView {
    if (!user) return 'owner';
    const role = (user.role || '').toLowerCase();
    if (role === 'owner' || role === 'super_admin' || role === 'brand_owner') return 'owner';
    if (role === 'manager' || role === 'studio_manager') return 'manager';
    if (role === 'trainer' || role === 'coach') return 'trainer';
    if (role === 'front_desk' || role === 'receptionist') return 'front_desk';
    return 'manager';
  }

  private resolveCapabilities(user: JwtPayload | undefined): Set<string> {
    if (!user) return new Set();
    const codes = new Set<string>(user.permission_codes || []);
    if (user.permissions) {
      for (const [module, actions] of Object.entries(user.permissions)) {
        for (const action of actions as string[]) {
          codes.add(`${module}.${action}`);
        }
      }
    }
    return codes;
  }

  private isOwnerLike(user: JwtPayload | undefined): boolean {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'owner' || role === 'super_admin' || role === 'brand_owner';
  }
}
