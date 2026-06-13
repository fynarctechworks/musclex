import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
// Json sentinels (Prisma.JsonNull) are per-generated-client runtime values, so
// for tenant writes they MUST come from the tenant client, not '@prisma/client'.
import { Prisma } from '../../node_modules/.prisma/client-tenant';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { DEFAULT_CURRENCY } from '../common/defaults';

interface PlanScopeFields {
  access_type?: string;
  tier?: string;
  allowed_branch_ids?: string[];
  allowed_city?: string | null;
  allowed_hours_json?: Record<string, unknown> | null;
  feature_flags?: Record<string, unknown>;
  branch_price_overrides?: Record<string, number | string>;
}

interface PlanCreateInput extends PlanScopeFields {
  name: string;
  description?: string;
  plan_type: string;
  duration_days?: number | string;
  total_classes?: number | string;
  max_classes_per_week?: number | string;
  max_visits?: number | string;
  price: number | string;
  yearly_price?: number | string;
  currency?: string;
  branch_id?: string;
  organization_id?: string;
  multi_branch_access?: boolean;
  grace_period_days?: number;
  auto_renew_enabled?: boolean;
  is_active?: boolean;
}

interface PlanUpdateInput extends PlanScopeFields {
  name?: string;
  description?: string;
  plan_type?: string;
  duration_days?: number | string;
  total_classes?: number | string;
  max_classes_per_week?: number | string;
  max_visits?: number | string;
  price?: number | string;
  yearly_price?: number | string;
  currency?: string;
  branch_id?: string;
  organization_id?: string;
  multi_branch_access?: boolean;
  grace_period_days?: number;
  is_active?: boolean;
  auto_renew_enabled?: boolean;
}

@Injectable()
export class PlansService {
  constructor(private tenant: TenantPrisma) {}

  // Prisma Decimal columns serialize as objects over JSON; coerce to plain numbers
  // so frontends can format `price` directly.
  private serialize<T extends { price?: unknown; yearly_price?: unknown } | null>(plan: T): T {
    if (!plan) return plan;
    const p = plan as any;
    if (p.price !== undefined && p.price !== null) p.price = Number(p.price.toString());
    if (p.yearly_price !== undefined && p.yearly_price !== null) p.yearly_price = Number(p.yearly_price.toString());
    return plan;
  }

  async findAll(filters?: {
    branch_id?: string;
    organization_id?: string;
    plan_type?: string;
    multi_branch_access?: boolean;
    is_active?: boolean;
  }) {
    const where: any = {};

    if (filters?.branch_id) {
      where.OR = [{ branch_id: filters.branch_id }, { branch_id: null }];
    }
    if (filters?.organization_id) where.organization_id = filters.organization_id;
    if (filters?.plan_type) where.plan_type = filters.plan_type;
    if (filters?.multi_branch_access !== undefined) where.multi_branch_access = filters.multi_branch_access;
    if (filters?.is_active !== undefined) where.is_active = filters.is_active;

    const plans = await this.tenant.client.membershipPlan.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return plans.map((p) => this.serialize(p));
  }

  async findOne(id: string) {
    const plan = await this.tenant.client.membershipPlan.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.serialize(plan);
  }

  private toIntOrNull(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = parseInt(String(value), 10);
    return isNaN(n) ? null : n;
  }

  async create(data: PlanCreateInput) {
    this.validateAccessScope(data);

    const accessType = data.access_type ?? 'single_branch';

    const plan = await this.tenant.client.membershipPlan.create({
      data: {
        gym_id: getTenantGymId()!,
        name: data.name,
        description: data.description || null,
        plan_type: data.plan_type,
        duration_days: this.toIntOrNull(data.duration_days),
        total_classes: this.toIntOrNull(data.total_classes),
        max_classes_per_week: this.toIntOrNull(data.max_classes_per_week),
        max_visits: this.toIntOrNull(data.max_visits),
        price: Number(data.price),
        yearly_price: data.yearly_price !== undefined && data.yearly_price !== '' ? Number(data.yearly_price) : null,
        currency: data.currency || DEFAULT_CURRENCY,
        branch_id: data.branch_id || null,
        organization_id: data.organization_id || null,
        // Legacy boolean — keep in sync with access_type so older code paths
        // that still read this flag (filters, exports) behave correctly.
        multi_branch_access:
          data.multi_branch_access ??
          (accessType === 'multi_branch' ||
            accessType === 'all_access' ||
            accessType === 'city_access'),
        grace_period_days: data.grace_period_days ?? 0,
        auto_renew_enabled: data.auto_renew_enabled || false,
        is_active: data.is_active ?? true,
        // ── Multi-gym access scope ──
        access_type: accessType,
        tier: (data.tier ?? '').trim() || 'standard',
        allowed_branch_ids:
          accessType === 'multi_branch' ? (data.allowed_branch_ids ?? []) : [],
        allowed_city: accessType === 'city_access' ? (data.allowed_city ?? null) : null,
        allowed_hours_json:
          accessType === 'time_based' && data.allowed_hours_json
            ? (data.allowed_hours_json as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        feature_flags: (data.feature_flags as Prisma.InputJsonValue) ?? {},
        branch_price_overrides:
          (this.sanitizeBranchOverrides(data.branch_price_overrides) as Prisma.InputJsonValue) ?? {},
      },
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    return this.serialize(plan);
  }

  async update(id: string, data: PlanUpdateInput) {
    const existing = await this.findOne(id);

    // If the update touches access scope at all, re-validate the resulting
    // shape (merge existing + incoming) so we don't end up with e.g. a
    // multi_branch plan with no allowed_branch_ids.
    const touchesScope =
      data.access_type !== undefined ||
      data.allowed_branch_ids !== undefined ||
      data.allowed_city !== undefined ||
      data.allowed_hours_json !== undefined;
    if (touchesScope) {
      this.validateAccessScope({
        access_type: data.access_type ?? (existing as any).access_type,
        allowed_branch_ids:
          data.allowed_branch_ids ?? (existing as any).allowed_branch_ids,
        allowed_city: data.allowed_city ?? (existing as any).allowed_city,
        allowed_hours_json:
          data.allowed_hours_json ?? (existing as any).allowed_hours_json,
      });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.plan_type !== undefined) updateData.plan_type = data.plan_type;
    if (data.duration_days !== undefined) updateData.duration_days = this.toIntOrNull(data.duration_days);
    if (data.total_classes !== undefined) updateData.total_classes = this.toIntOrNull(data.total_classes);
    if (data.max_classes_per_week !== undefined) updateData.max_classes_per_week = this.toIntOrNull(data.max_classes_per_week);
    if (data.max_visits !== undefined) updateData.max_visits = this.toIntOrNull(data.max_visits);
    if (data.price !== undefined) updateData.price = Number(data.price);
    if (data.yearly_price !== undefined) updateData.yearly_price = data.yearly_price !== null && data.yearly_price !== '' ? Number(data.yearly_price) : null;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.branch_id !== undefined) updateData.branch_id = data.branch_id || null;
    if (data.organization_id !== undefined) updateData.organization_id = data.organization_id || null;
    if (data.multi_branch_access !== undefined) updateData.multi_branch_access = data.multi_branch_access;
    if (data.grace_period_days !== undefined) updateData.grace_period_days = data.grace_period_days;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.auto_renew_enabled !== undefined) updateData.auto_renew_enabled = data.auto_renew_enabled;
    // ── Multi-gym access scope ──
    if (data.access_type !== undefined) updateData.access_type = data.access_type;
    if (data.tier !== undefined) updateData.tier = data.tier;
    if (data.allowed_branch_ids !== undefined) {
      updateData.allowed_branch_ids = data.allowed_branch_ids;
    }
    if (data.allowed_city !== undefined) {
      updateData.allowed_city = data.allowed_city || null;
    }
    if (data.allowed_hours_json !== undefined) {
      updateData.allowed_hours_json = data.allowed_hours_json
        ? (data.allowed_hours_json as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (data.feature_flags !== undefined) {
      updateData.feature_flags = (data.feature_flags as Prisma.InputJsonValue) ?? {};
    }
    if (data.branch_price_overrides !== undefined) {
      updateData.branch_price_overrides =
        (this.sanitizeBranchOverrides(data.branch_price_overrides) as Prisma.InputJsonValue) ?? {};
    }

    const plan = await this.tenant.client.membershipPlan.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    return this.serialize(plan);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Cross-field validation for access scope. Mirrors the resolver's contract:
   * each access_type has its own required field. Throws BadRequest with a
   * specific message so the UI can surface it.
   */
  private validateAccessScope(input: {
    access_type?: string;
    allowed_branch_ids?: unknown;
    allowed_city?: unknown;
    allowed_hours_json?: unknown;
  }): void {
    const t = input.access_type;
    if (!t || t === 'single_branch' || t === 'class_only') return;

    if (t === 'multi_branch') {
      const ids = input.allowed_branch_ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestException(
          'Multi-branch plans must include at least one branch in allowed_branch_ids',
        );
      }
    } else if (t === 'city_access') {
      const city = input.allowed_city;
      if (typeof city !== 'string' || city.trim() === '') {
        throw new BadRequestException(
          'City-access plans require allowed_city',
        );
      }
    } else if (t === 'time_based') {
      const hrs = input.allowed_hours_json as
        | { start?: unknown; end?: unknown }
        | null
        | undefined;
      if (
        !hrs ||
        typeof hrs.start !== 'string' ||
        typeof hrs.end !== 'string'
      ) {
        throw new BadRequestException(
          'Time-based plans require allowed_hours_json with start and end (HH:mm)',
        );
      }
    } else if (t !== 'all_access') {
      throw new BadRequestException(`Unknown access_type: ${t}`);
    }
  }

  /**
   * Strips invalid entries from branch_price_overrides: only positive
   * numbers survive. Stringified numbers from form JSON are accepted.
   * Returns null when nothing valid remains (caller stores {} default).
   */
  private sanitizeBranchOverrides(
    input: unknown,
  ): Record<string, number> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const n = typeof v === 'string' ? parseFloat(v) : (v as number);
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
        cleaned[k] = n;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.tenant.client.membershipPlan.update({
      where: { id },
      data: { is_active: false },
    });
    return { success: true };
  }

  async findByType(planType: string) {
    const plans = await this.tenant.client.membershipPlan.findMany({
      where: { plan_type: planType, is_active: true },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { price: 'asc' },
    });
    return plans.map((p) => this.serialize(p));
  }
}
