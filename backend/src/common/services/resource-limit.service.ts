import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_CONFIGS } from '../plan-configs';

/**
 * Reusable service that enforces tenant resource limits based on subscription plan.
 *
 * Design decision: The main backend's Studio model stores `subscription_plan` as a
 * string (plan name like "free", "starter", "pro", "enterprise"). Plan limits are
 * resolved from:
 *   1. The SubscriptionPlan table in the public schema (authoritative, DB-driven)
 *   2. Fallback to the in-memory PLAN_CONFIGS map if DB lookup fails
 *
 * This avoids cross-database calls to the SaaS Control Center. The SCC's Tenant model
 * also stores max_members/max_branches, but those live in a separate database.
 * If a unified approach is needed later, add an internal API from SCC to main backend.
 */
@Injectable()
export class ResourceLimitService {
  private readonly logger = new Logger(ResourceLimitService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get the plan limits for a studio. Tries DB first, falls back to in-memory config.
   */
  async getPlanLimits(studioId: string): Promise<{
    max_members: number;
    max_branches: number;
    max_staff: number;
    plan_name: string;
  }> {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { subscription_plan: true },
    });

    if (!studio) {
      throw new ForbiddenException('Studio not found');
    }

    const planName = studio.subscription_plan;

    // Try DB-driven limits first
    const dbPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
      select: { max_members: true, max_branches: true, max_staff: true },
    });

    if (dbPlan) {
      return { ...dbPlan, plan_name: planName };
    }

    // Fallback to in-memory config
    const config = PLAN_CONFIGS[planName];
    if (config) {
      return {
        max_members: config.max_members,
        max_branches: config.max_branches,
        max_staff: config.max_staff,
        plan_name: planName,
      };
    }

    // Unknown plan — use the most restrictive defaults (free tier)
    this.logger.warn(`Unknown plan "${planName}" for studio ${studioId}, using free tier limits`);
    return {
      max_members: 50,
      max_branches: 1,
      max_staff: 3,
      plan_name: planName,
    };
  }

  /**
   * Check if creating a new member would exceed the plan's member limit.
   * Throws ForbiddenException if limit reached.
   */
  async checkMemberLimit(studioId: string, organizationId?: string): Promise<void> {
    const limits = await this.getPlanLimits(studioId);

    // Tenant isolation via search_path; optionally filter by org
    const currentCount = await this.prisma.member.count({
      where: {
        ...(organizationId ? { organization_id: organizationId } : {}),
        status: { not: 'deleted' },
      },
    });

    if (currentCount >= limits.max_members) {
      throw new ForbiddenException(
        `Member limit reached for your ${limits.plan_name} plan (${limits.max_members} members). Upgrade to add more.`,
      );
    }
  }

  /**
   * Check if creating a new branch would exceed the plan's branch limit.
   * Throws ForbiddenException if limit reached.
   */
  async checkBranchLimit(studioId: string, organizationId?: string): Promise<void> {
    const limits = await this.getPlanLimits(studioId);

    const currentCount = await this.prisma.branch.count({
      where: {
        ...(organizationId ? { organization_id: organizationId } : {}),
        status: 'active',
      }, // tenant isolation via search_path — only count active branches
    });

    if (currentCount >= limits.max_branches) {
      throw new ForbiddenException(
        `Branch limit reached for your ${limits.plan_name} plan (${limits.max_branches} branches). Upgrade your plan to add more branches.`,
      );
    }
  }

  /**
   * Check if creating a new staff member would exceed the plan's staff limit.
   * Throws ForbiddenException if limit reached.
   */
  async checkStaffLimit(studioId: string, organizationId?: string): Promise<void> {
    const limits = await this.getPlanLimits(studioId);

    const currentCount = await this.prisma.staff.count({
      where: {
        ...(organizationId ? { organization_id: organizationId } : {}),
        status: 'active',
      },
    });

    if (currentCount >= limits.max_staff) {
      throw new ForbiddenException(
        `Staff limit reached for your ${limits.plan_name} plan (${limits.max_staff} staff). Upgrade your plan to add more staff.`,
      );
    }
  }

  /**
   * Check if the studio's current plan includes access to a specific feature.
   * Throws ForbiddenException with upgrade message if the feature is not enabled.
   *
   * Feature keys: staff_management, trainer_management, class_scheduling,
   * marketing_campaigns, whatsapp_notifications, email_campaigns, ai_advisor,
   * api_access, multi_branch, custom_roles, audit_logs, payment_gateway
   */
  async checkFeatureAccess(studioId: string, featureKey: string): Promise<void> {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { subscription_plan: true },
    });
    if (!studio) throw new ForbiddenException('Studio not found');

    const planName = studio.subscription_plan;

    const dbPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
      select: { features: true, display_name: true },
    });

    const features: Record<string, boolean> = dbPlan?.features
      ? (dbPlan.features as Record<string, boolean>)
      : (PLAN_CONFIGS[planName]?.features ?? {});

    const planDisplayName = (dbPlan as any)?.display_name
      ?? PLAN_CONFIGS[planName]?.display_name
      ?? planName;

    if (!features[featureKey]) {
      throw new ForbiddenException(
        `The "${featureKey.replace(/_/g, ' ')}" feature is not available on your ${planDisplayName} plan. Upgrade your plan to access this feature.`,
      );
    }
  }

  /**
   * Returns current usage stats for a studio — useful for limit progress bars in the UI.
   */
  async getUsage(studioId: string, organizationId?: string) {
    const limits = await this.getPlanLimits(studioId);
    const orgWhere = organizationId ? { organization_id: organizationId } : {};

    const [memberCount, branchCount, staffCount] = await Promise.all([
      this.prisma.member.count({
        where: { ...orgWhere, status: { not: 'deleted' } }, // tenant isolation via search_path
      }),
      this.prisma.branch.count({
        where: { ...orgWhere, status: 'active' }, // tenant isolation via search_path — only count active
      }),
      this.prisma.staff.count({
        where: { ...orgWhere, status: 'active' },
      }),
    ]);

    return {
      members: { current: memberCount, max: limits.max_members, percent: Math.min(100, Math.round((memberCount / limits.max_members) * 100)) },
      branches: { current: branchCount, max: limits.max_branches, percent: Math.min(100, Math.round((branchCount / limits.max_branches) * 100)) },
      staff: { current: staffCount, max: limits.max_staff, percent: Math.min(100, Math.round((staffCount / limits.max_staff) * 100)) },
      plan_name: limits.plan_name,
    };
  }
}
