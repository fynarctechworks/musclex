import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_CONFIGS } from '../common/plan-configs';

const CACHE_KEY = 'public:onboarding:plans';
const CACHE_TTL_MS = 60_000; // 60 seconds

// Derive DEFAULT_PLANS from the single source of truth (PLAN_CONFIGS)
const DEFAULT_PLANS = Object.entries(PLAN_CONFIGS).map(([name, config], idx) => ({
  name,
  display_name: config.display_name,
  description: config.description,
  monthly_price: config.monthly_price,
  annual_price: config.annual_price,
  max_branches: config.max_branches,
  max_members: config.max_members,
  max_staff: config.max_staff,
  storage_limit_gb: config.storage_limit_gb,
  api_access: config.api_access,
  is_active: true,
  is_featured: name === 'pro',
  sort_order: idx,
  plan_type: config.plan_type,
  features: config.features,
}));

@Injectable()
export class OnboardingPlansService implements OnModuleInit {
  private readonly logger = new Logger(OnboardingPlansService.name);
  private cache: { data: any[]; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensurePlansSeeded();
  }

  private async ensurePlansSeeded(): Promise<void> {
    // Upsert each default plan so newly added plans get inserted
    // even when other plans already exist.
    for (const plan of DEFAULT_PLANS) {
      const existing = await this.prisma.subscriptionPlan.findUnique({
        where: { name: plan.name },
      });
      if (existing) continue;
      this.logger.log(`Seeding missing plan: ${plan.name}`);
      await this.prisma.subscriptionPlan.create({ data: plan as any });
    }
  }

  private computeEffectivePrices(plan: any) {
    const monthly = Number(plan.monthly_price);
    const annual = Number(plan.annual_price);
    const discount = plan.discount_percent ?? 0;
    const expiry = plan.discount_expires_at
      ? new Date(plan.discount_expires_at)
      : null;
    const isDiscountActive =
      discount > 0 && (expiry === null || expiry > new Date());

    return {
      id: plan.id,
      name: plan.name,
      display_name: plan.display_name,
      description: plan.description,
      monthly_price: monthly,
      annual_price: annual,
      effective_monthly_price: isDiscountActive
        ? +(monthly * (1 - discount / 100)).toFixed(2)
        : monthly,
      effective_annual_price: isDiscountActive
        ? +(annual * (1 - discount / 100)).toFixed(2)
        : annual,
      discount_percent: plan.discount_percent,
      discount_label: plan.discount_label,
      discount_expires_at: plan.discount_expires_at,
      is_discount_active: isDiscountActive,
      max_branches: plan.max_branches,
      max_members: plan.max_members,
      max_staff: plan.max_staff,
      storage_limit_gb: plan.storage_limit_gb,
      api_access: plan.api_access,
      features: plan.features,
      is_featured: plan.is_featured,
      sort_order: plan.sort_order,
      plan_type: (plan as any).plan_type ?? 'regular',
    };
  }

  async getPublicPlans(planType?: 'regular'): Promise<any[]> {
    // Check in-memory cache (only for unfiltered requests)
    if (!planType && this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.data;
    }

    const where: Record<string, unknown> = { is_active: true };
    where.plan_type = 'regular';

    const plans = await this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    const result = plans.map((p) => this.computeEffectivePrices(p));

    // Store in cache only for unfiltered requests
    if (!planType) {
      this.cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    }

    return result;
  }

  invalidateCache(key: string): void {
    if (key === CACHE_KEY || key === '*') {
      this.cache = null;
      this.logger.log(`Cache invalidated: ${key}`);
    }
  }
}
