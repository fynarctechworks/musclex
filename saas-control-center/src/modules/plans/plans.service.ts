import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction } from '@prisma/client';
import { CreatePlanDto, UpdatePlanDto } from './dto/plans.dto';
import { UpdateGstDto } from './dto/gst.dto';
import axios from 'axios';

export interface GstSettings {
  gst_enabled: boolean;
  gst_percent: number;
  gst_label: string;
}

interface PublicPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_branches: number;
  max_members: number;
  max_staff: number;
  storage_limit_gb: number;
  api_access: boolean;
  features: Record<string, boolean>;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  plan_type: 'regular';
  discount_percent: number | null;
  discount_label: string | null;
  discount_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlanResponse extends PublicPlan {
  effective_monthly_price: number;
  effective_annual_price: number;
  is_discount_active: boolean;
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
    private config: ConfigService,
  ) {}

  /**
   * Tell the marketing website to drop its cached plan catalogue.
   *
   * The pricing page is ISR with a 5-minute window; without this ping an edit
   * here would take that long to appear publicly. Best-effort and never
   * awaited into the caller's failure path — the same posture as syncToScc:
   * an unreachable marketing site must never block a plan edit.
   */
  private notifyMarketing(): void {
    const base = this.config.get<string>('MARKETING_SITE_URL')?.replace(/\/$/, '');
    const secret = this.config.get<string>('MARKETING_INGEST_SECRET');
    if (!base || !secret) return;

    void fetch(`${base}/api/revalidate-plans`, {
      method: 'POST',
      headers: { 'x-ingest-secret': secret },
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => {
        if (!res.ok) {
          this.logger.warn(`Marketing revalidation returned ${res.status}`);
        }
      })
      .catch((err) => {
        this.logger.warn(`Marketing revalidation failed: ${(err as Error).name}`);
      });
  }

  private computeEffectivePrices(plan: PublicPlan): PlanResponse {
    const monthly = Number(plan.monthly_price);
    const annual = Number(plan.annual_price);
    const discount = plan.discount_percent ?? 0;
    const expiry = plan.discount_expires_at
      ? new Date(plan.discount_expires_at)
      : null;
    const isDiscountActive =
      discount > 0 && (expiry === null || expiry > new Date());

    return {
      ...plan,
      monthly_price: monthly,
      annual_price: annual,
      effective_monthly_price: isDiscountActive
        ? +(monthly * (1 - discount / 100)).toFixed(2)
        : monthly,
      effective_annual_price: isDiscountActive
        ? +(annual * (1 - discount / 100)).toFixed(2)
        : annual,
      is_discount_active: isDiscountActive,
    };
  }

  /**
   * Mirror an onboarding (public.subscription_plans) plan into the SCC-owned
   * scc.subscription_plans table — matched by `name`. The scc table is what
   * `Tenant.plan_id` / `Subscription.plan_id` reference and what billing/MRR
   * reads, so this keeps a single effective source of truth: admins edit the
   * public catalog and billing follows. Best-effort; never blocks the edit.
   */
  private async syncToScc(plan: PublicPlan): Promise<void> {
    const limits = {
      max_members: plan.max_members,
      max_branches: plan.max_branches,
      max_staff: plan.max_staff,
      storage_mb: (plan.storage_limit_gb ?? 0) * 1024,
    };
    const shared = {
      description: plan.description ?? null,
      price_monthly: Number(plan.monthly_price),
      price_yearly: Number(plan.annual_price),
      features: (plan.features ?? {}) as object,
      limits,
      sort_order: plan.sort_order ?? 0,
      is_active: plan.is_active,
    };
    try {
      await this.prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        update: shared,
        create: { name: plan.name, ...shared },
      });
    } catch (err: any) {
      this.logger.warn(
        `SCC plan mirror sync failed (non-fatal) for "${plan.name}": ${err?.message}`,
      );
    }
  }

  /**
   * Plans valid for tenant assignment — returned from the SCC table that the
   * `Tenant.plan_id` foreign key actually references (NOT public). Used by the
   * Add-Tenant picker so the selected id is always a valid FK target.
   */
  /**
   * Public plan catalogue for the marketing website's pricing page.
   *
   * Reads the same `public.subscription_plans` table the SCC Plans screen
   * edits, so a price or limit changed by an admin shows on the marketing site
   * on its next revalidation — there is no second copy to keep in sync.
   *
   * Returns only ACTIVE, regular plans, and only fields that are safe to show
   * publicly. Effective prices already account for an active discount.
   */
  async findForMarketing(): Promise<PlanResponse[]> {
    const rows: PublicPlan[] = await this.prisma.$queryRaw`
      SELECT * FROM public.subscription_plans
      WHERE is_active = true AND plan_type = 'regular'
      ORDER BY sort_order ASC
    `;
    return rows.map((p) => this.computeEffectivePrices(p));
  }

  async findAssignable() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { is_active: true },
      select: { id: true, name: true, price_monthly: true },
      orderBy: { sort_order: 'asc' },
    });
    return plans.map((p) => ({ ...p, price_monthly: Number(p.price_monthly) }));
  }

  private async invalidateOnboardingCache(): Promise<void> {
    const secret = process.env.INTERNAL_API_SECRET;
    const mainAppUrl =
      process.env.MAIN_APP_API_URL ?? 'http://localhost:4000';
    if (!secret) {
      this.logger.warn(
        'INTERNAL_API_SECRET not set — skipping cache invalidation',
      );
      return;
    }

    try {
      await axios.post(
        `${mainAppUrl}/api/v1/internal/cache/invalidate`,
        { key: 'public:onboarding:plans' },
        { headers: { 'X-Internal-Secret': secret }, timeout: 3000 },
      );
      this.logger.log('Onboarding plans cache invalidated');
    } catch (err: any) {
      this.logger.warn(
        `Cache invalidation failed (non-fatal): ${err?.message}`,
      );
    }
  }

  async findAll(includeInactive = false): Promise<PlanResponse[]> {
    const plans: PublicPlan[] = includeInactive
      ? await this.prisma.$queryRaw`
          SELECT * FROM public.subscription_plans
          ORDER BY sort_order ASC, created_at ASC
        `
      : await this.prisma.$queryRaw`
          SELECT * FROM public.subscription_plans
          WHERE is_active = true
          ORDER BY sort_order ASC, created_at ASC
        `;

    return plans.map((p) => this.computeEffectivePrices(p));
  }

  async findOne(id: string): Promise<PlanResponse> {
    const plans: PublicPlan[] = await this.prisma.$queryRaw`
      SELECT * FROM public.subscription_plans WHERE id = ${id}::uuid
    `;

    if (plans.length === 0) {
      throw new NotFoundException(`Plan with id "${id}" not found`);
    }

    return this.computeEffectivePrices(plans[0]);
  }

  async create(dto: CreatePlanDto, ctx: AuditContext): Promise<PlanResponse> {
    // Check for duplicate name
    const existing: PublicPlan[] = await this.prisma.$queryRaw`
      SELECT id FROM public.subscription_plans WHERE name = ${dto.name}
    `;
    if (existing.length > 0) {
      throw new ConflictException(`A plan named "${dto.name}" already exists`);
    }

    const featuresJson = JSON.stringify(dto.features);
    const discountExpiresAt = dto.discount_expires_at
      ? new Date(dto.discount_expires_at)
      : null;

    const created: PublicPlan[] = await this.prisma.$queryRaw`
      INSERT INTO public.subscription_plans (
        name, display_name, description,
        monthly_price, annual_price,
        max_branches, max_members, max_staff,
        storage_limit_gb, api_access,
        features, is_active, is_featured, sort_order,
        plan_type,
        discount_percent, discount_label, discount_expires_at,
        created_at, updated_at
      ) VALUES (
        ${dto.name}, ${dto.display_name}, ${dto.description ?? null},
        ${dto.monthly_price}, ${dto.annual_price},
        ${dto.max_branches}, ${dto.max_members}, ${dto.max_staff},
        ${dto.storage_limit_gb ?? 1}, ${dto.api_access ?? false},
        ${featuresJson}::jsonb, ${dto.is_active ?? true}, ${dto.is_featured ?? false}, ${dto.sort_order ?? 0},
        ${dto.plan_type ?? 'regular'},
        ${dto.discount_percent ?? null}, ${dto.discount_label ?? null}, ${discountExpiresAt},
        NOW(), NOW()
      )
      RETURNING *
    `;

    await this.audit.log(
      AuditAction.CREATE,
      'subscription_plan',
      created[0].id,
      ctx,
      { new_value: created[0] },
    );
    this.notifyMarketing();

    await this.syncToScc(created[0]);
    await this.invalidateOnboardingCache();
    return this.computeEffectivePrices(created[0]);
  }

  async update(
    id: string,
    dto: UpdatePlanDto,
    ctx: AuditContext,
  ): Promise<PlanResponse> {
    const existing = await this.findOne(id);

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== existing.name) {
      const conflict: PublicPlan[] = await this.prisma.$queryRaw`
        SELECT id FROM public.subscription_plans
        WHERE name = ${dto.name} AND id != ${id}::uuid
      `;
      if (conflict.length > 0) {
        throw new ConflictException(
          `A plan named "${dto.name}" already exists`,
        );
      }
    }

    // Build dynamic SET clause
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      display_name: 'display_name',
      description: 'description',
      monthly_price: 'monthly_price',
      annual_price: 'annual_price',
      max_branches: 'max_branches',
      max_members: 'max_members',
      max_staff: 'max_staff',
      storage_limit_gb: 'storage_limit_gb',
      api_access: 'api_access',
      is_active: 'is_active',
      is_featured: 'is_featured',
      sort_order: 'sort_order',
      discount_percent: 'discount_percent',
      discount_label: 'discount_label',
      plan_type: 'plan_type',
    };

    for (const [dtoKey, dbCol] of Object.entries(fieldMap)) {
      if ((dto as any)[dtoKey] !== undefined) {
        setClauses.push(`${dbCol} = $${paramIndex}`);
        values.push((dto as any)[dtoKey]);
        paramIndex++;
      }
    }

    // Handle features (needs JSON cast)
    if (dto.features !== undefined) {
      setClauses.push(`features = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(dto.features));
      paramIndex++;
    }

    // Handle discount_expires_at (needs date conversion)
    if (dto.discount_expires_at !== undefined) {
      setClauses.push(`discount_expires_at = $${paramIndex}`);
      values.push(
        dto.discount_expires_at ? new Date(dto.discount_expires_at) : null,
      );
      paramIndex++;
    }

    values.push(id); // for WHERE clause

    const query = `
      UPDATE public.subscription_plans
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}::uuid
      RETURNING *
    `;

    const updated: PublicPlan[] =
      await this.prisma.$queryRawUnsafe(query, ...values);

    await this.audit.log(AuditAction.UPDATE, 'subscription_plan', id, ctx, {
      old_value: { name: existing.name, monthly_price: existing.monthly_price },
      new_value: dto,
    });
    this.notifyMarketing();

    await this.syncToScc(updated[0]);
    await this.invalidateOnboardingCache();
    return this.computeEffectivePrices(updated[0]);
  }

  async toggleActive(id: string, ctx: AuditContext): Promise<PlanResponse> {
    const plan = await this.findOne(id);
    const newStatus = !plan.is_active;

    const updated: PublicPlan[] = await this.prisma.$queryRaw`
      UPDATE public.subscription_plans
      SET is_active = ${newStatus}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    await this.audit.log(AuditAction.UPDATE, 'subscription_plan', id, ctx, {
      old_value: { is_active: plan.is_active },
      new_value: { is_active: newStatus },
    });
    this.notifyMarketing();

    await this.syncToScc(updated[0]);
    await this.invalidateOnboardingCache();
    return this.computeEffectivePrices(updated[0]);
  }

  async toggleFeatured(id: string, ctx: AuditContext): Promise<PlanResponse> {
    const plan = await this.findOne(id);
    const newFeatured = !plan.is_featured;

    const updated: PublicPlan[] = await this.prisma.$queryRaw`
      UPDATE public.subscription_plans
      SET is_featured = ${newFeatured}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    await this.audit.log(AuditAction.UPDATE, 'subscription_plan', id, ctx, {
      old_value: { is_featured: plan.is_featured },
      new_value: { is_featured: newFeatured },
    });
    this.notifyMarketing();

    await this.invalidateOnboardingCache();
    return this.computeEffectivePrices(updated[0]);
  }

  async updateSortOrder(
    id: string,
    sortOrder: number,
    ctx: AuditContext,
  ): Promise<{ success: boolean }> {
    await this.findOne(id);

    await this.prisma.$queryRaw`
      UPDATE public.subscription_plans
      SET sort_order = ${sortOrder}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    await this.audit.log(AuditAction.UPDATE, 'subscription_plan', id, ctx, {
      new_value: { sort_order: sortOrder },
    });
    this.notifyMarketing();

    await this.invalidateOnboardingCache();
    return { success: true };
  }

  async remove(id: string, ctx: AuditContext): Promise<{ success: boolean }> {
    const plan = await this.findOne(id);

    await this.prisma.$queryRaw`
      UPDATE public.subscription_plans
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    // Deactivate the scc mirror too, so billing stops treating it as available.
    await this.prisma.subscriptionPlan
      .updateMany({ where: { name: plan.name }, data: { is_active: false } })
      .catch(() => undefined);

    await this.audit.log(AuditAction.UPDATE, 'subscription_plan', id, ctx, {
      new_value: { is_active: false },
    });
    this.notifyMarketing();

    await this.invalidateOnboardingCache();
    return { success: true };
  }

  // ── Platform GST (single global rate) ─────────────────────────────────────

  /**
   * Read the platform-wide subscription GST setting from scc.platform_settings.
   * Falls back to a disabled 0% if the row is missing so nothing breaks before
   * the migration runs.
   */
  async getGstSettings(): Promise<GstSettings> {
    const rows = await this.prisma.$queryRaw<Array<{ value: any }>>`
      SELECT value FROM scc.platform_settings WHERE key = 'subscription_gst' LIMIT 1
    `;
    const v = rows[0]?.value ?? {};
    const percent = Number(v.percent ?? 0);
    return {
      gst_enabled: v.enabled !== false,
      gst_percent: Number.isFinite(percent) ? percent : 0,
      gst_label: typeof v.label === 'string' && v.label.trim() ? v.label : 'GST',
    };
  }

  /**
   * Upsert the platform-wide subscription GST setting. Invalidates the
   * onboarding cache so the public payment page picks up the new rate.
   */
  async updateGstSettings(dto: UpdateGstDto, ctx: AuditContext): Promise<GstSettings> {
    const percent = Number(dto.gst_percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new BadRequestException('gst_percent must be a number between 0 and 100');
    }
    const value = {
      enabled: dto.gst_enabled ?? true,
      percent: +percent.toFixed(2),
      label: (dto.gst_label ?? 'GST').trim() || 'GST',
    };

    await this.prisma.$executeRaw`
      INSERT INTO scc.platform_settings (key, value, description, updated_at, updated_by)
      VALUES (
        'subscription_gst',
        ${JSON.stringify(value)}::jsonb,
        'GST added on top of subscription plan prices (exclusive). percent in [0,100].',
        NOW(),
        ${ctx.admin_id}::uuid
      )
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `;

    await this.audit.log(
      AuditAction.UPDATE,
      'platform_setting',
      'subscription_gst',
      ctx,
      { new_value: value },
    );
    this.notifyMarketing();
    await this.invalidateOnboardingCache();

    return {
      gst_enabled: value.enabled,
      gst_percent: value.percent,
      gst_label: value.label,
    };
  }
}
