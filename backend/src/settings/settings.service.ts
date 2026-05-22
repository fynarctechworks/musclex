import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import {
  PLAN_CONFIGS,
  fetchAvailablePlans,
} from '../common/plan-configs';
import { SccSyncService } from '../common/services/scc-sync.service';
import { SubscriptionPolicyService } from '../common/services/subscription-policy.service';
import { DEFAULT_LOCALE } from '../common/defaults';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private sccSync: SccSyncService,
    private subscriptionPolicy: SubscriptionPolicyService,
  ) {}

  async getStudio(studioId: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) throw new NotFoundException('Studio not found');
    return studio;
  }

  async getAccountOverview(studioId: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      include: { invoices: { orderBy: { created_at: 'desc' }, take: 1 } },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    // Use the LIVE-computed lifecycle status (active/grace_period/locked/
    // suspended), not the stale studio.subscription_status column that's frozen
    // at 'active' from onboarding. This is the same source the lock banner reads,
    // so the Status chip and the banner can no longer disagree.
    const subscriptionContext = await this.subscriptionPolicy.getContext(studioId);

    const planConfig = PLAN_CONFIGS[studio.subscription_plan] || PLAN_CONFIGS.free;

    // Fetch usage counts — tenant isolation relies on search_path set by TenantMiddleware
    const [branchCount, memberCount, staffCount] = await Promise.all([
      this.prisma.branch.count({ where: { is_active: true } }),
      this.prisma.member.count({ where: { status: 'active' } }),
      this.prisma.staff.count({ where: { is_active: true } }),
    ]);

    const effectivePlanConfig = planConfig;

    return {
      account_type: (studio as any).account_type || 'gym',
      studio: {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        logo_url: studio.logo_url,
        owner_user_id: studio.owner_user_id,
        tagline: studio.tagline,
        phone: studio.phone,
        email: studio.email,
        website: studio.website,
        address: studio.address,
        city: studio.city,
        state: studio.state,
        country: studio.country,
        postal_code: studio.postal_code,
        business_name: studio.business_name,
        business_type: studio.business_type,
        timezone: studio.timezone,
        currency: studio.currency,
        email_verified: studio.email_verified,
        phone_verified: studio.phone_verified,
        two_factor_enabled: studio.two_factor_enabled,
        created_at: studio.created_at,
        last_login_at: studio.last_login_at,
      },
      subscription: {
        plan: studio.subscription_plan,
        plan_description: planConfig.description,
        status: subscriptionContext.status,
        billing_cycle: studio.billing_cycle,
        monthly_price: planConfig.monthly_price,
        annual_price: planConfig.annual_price,
        price:
          studio.billing_cycle === 'annual'
            ? planConfig.annual_price
            : planConfig.monthly_price,
        subscription_start: studio.subscription_start,
        next_billing_date: studio.next_billing_date,
        trial_ends_at: studio.trial_ends_at,
        // Grace/lock context so the UI can mirror the lock banner exactly.
        grace_until: subscriptionContext.grace_until,
        locked_at: subscriptionContext.locked_at,
        days_until_expiry: subscriptionContext.days_until_expiry,
        grace_days_remaining: subscriptionContext.grace_days_remaining,
        can_mutate: subscriptionContext.can_mutate,
      },
      usage: {
        branches: { current: branchCount, max: effectivePlanConfig.max_branches },
        members: { current: memberCount, max: effectivePlanConfig.max_members },
        staff: { current: staffCount, max: effectivePlanConfig.max_staff },
        storage_limit_gb: effectivePlanConfig.storage_limit_gb,
        api_access: effectivePlanConfig.api_access,
      },
      features: effectivePlanConfig.features,
      billing: {
        billing_name: studio.billing_name,
        billing_email: studio.billing_email,
        billing_address: studio.billing_address,
        tax_id: studio.tax_id,
        currency: studio.currency,
        // GST tax-invoice settings (India)
        gstin: (studio as any).gstin ?? null,
        gst_state_code: (studio as any).gst_state_code ?? null,
        default_hsn: (studio as any).default_hsn ?? null,
        invoice_prefix: (studio as any).invoice_prefix ?? null,
        invoice_terms: (studio as any).invoice_terms ?? null,
      },
    };
  }

  async getInvoices(studioId: string) {
    return this.prisma.invoice.findMany({
      where: { studio_id: studioId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async getBranchSummary(studioId?: string) {
    // Tenant isolation via search_path. organization_id adds a secondary guard.
    const branches = await this.prisma.branch.findMany({
      where: studioId ? { organization_id: studioId } : undefined,
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      city: b.city,
      address: b.address,
      phone: b.phone,
      is_active: b.is_active,
      member_count: b._count.members,
      created_at: b.created_at,
    }));
  }

  async getAvailablePlans() {
    return fetchAvailablePlans(this.prisma);
  }

  async updateStudio(
    studioId: string,
    data: {
      name?: string;
      tagline?: string;
      phone?: string;
      email?: string;
      website?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      postal_code?: string;
      business_name?: string;
      business_type?: string;
      timezone?: string;
      currency?: string;
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
      gstin?: string;
      gst_state_code?: string;
      default_hsn?: string;
      invoice_prefix?: string;
      invoice_terms?: string;
      referral_free_days?: number;
      referral_reward_days?: number;
    },
  ) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    const updated = await this.prisma.studio.update({
      where: { id: studioId },
      data,
    });

    // Sync name/contact changes to SCC. Pass the persisted lifecycle_status
    // (the source of truth, kept current by the daily recompute cron and
    // renewal/cancel events) so the SCC dashboard reflects reality.
    await this.sccSync.upsertTenant({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      email: updated.email,
      phone: updated.phone,
      logo_url: updated.logo_url,
      subscription_plan: updated.subscription_plan,
      lifecycle_status: updated.lifecycle_status ?? undefined,
      subscription_status: updated.subscription_status,
      trial_ends_at: updated.trial_ends_at,
    });

    return updated;
  }

  async getReferralSettings(studioId: string) {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');
    return {
      referral_free_days: studio.referral_free_days ?? 0,
      referral_reward_days: studio.referral_reward_days ?? 0,
    };
  }

  async updateReferralSettings(studioId: string, data: { referral_free_days?: number; referral_reward_days?: number }) {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');
    const updated = await this.prisma.studio.update({
      where: { id: studioId },
      data: {
        ...(data.referral_free_days !== undefined ? { referral_free_days: data.referral_free_days } : {}),
        ...(data.referral_reward_days !== undefined ? { referral_reward_days: data.referral_reward_days } : {}),
      },
    });
    return {
      referral_free_days: updated.referral_free_days ?? 0,
      referral_reward_days: updated.referral_reward_days ?? 0,
    };
  }

  async changePlan(studioId: string, newPlan: string, billingCycle?: string) {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');

    const planConfig = PLAN_CONFIGS[newPlan];
    if (!planConfig) throw new NotFoundException('Plan not found');

    const oldPlan = studio.subscription_plan;
    const now = new Date();

    const updated = await this.prisma.studio.update({
      where: { id: studioId },
      data: {
        subscription_plan: newPlan,
        subscription_status: 'active',
        billing_cycle: billingCycle || studio.billing_cycle || 'monthly',
        subscription_start: now,
        next_billing_date: new Date(now.getTime() + (billingCycle === 'annual' ? 365 : 30) * 86400000),
      },
    });

    // Send upgrade confirmation email
    const email = studio.billing_email || studio.email;
    if (email) {
      const price = billingCycle === 'annual' ? planConfig.annual_price : planConfig.monthly_price;
      await this.queueService.enqueueEmail({
        to: email,
        subject: `Plan Upgraded to ${planConfig.display_name} — ${studio.name}`,
        template: `
          <div style="max-width:560px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:32px;">
            <h1 style="font-size:22px;color:#1a1a1a;margin:0 0 16px;">Plan Upgrade Confirmed</h1>
            <p style="font-size:14px;color:#333;margin:0 0 20px;">
              Your plan for <strong>{{ studio_name }}</strong> has been upgraded successfully.
            </p>
            <div style="background:#f8f8f8;border-radius:12px;padding:20px;margin-bottom:24px;">
              <table style="width:100%;font-size:14px;">
                <tr><td style="padding:6px 0;color:#666;">Previous Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{ old_plan }}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">New Plan</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#4A9FD4;">{{ new_plan }}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">Price</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{ price }}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">Billing Cycle</td><td style="padding:6px 0;text-align:right;">{{ billing_cycle }}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">Effective Date</td><td style="padding:6px 0;text-align:right;">{{ effective_date }}</td></tr>
              </table>
            </div>
            <p style="font-size:12px;color:#999;">If you didn't make this change, please contact support immediately.</p>
          </div>
        `,
        variables: {
          studio_name: studio.name,
          old_plan: PLAN_CONFIGS[oldPlan]?.display_name || oldPlan,
          new_plan: planConfig.display_name,
          price: `${studio.currency ?? '₹'}${price}/${billingCycle === 'annual' ? 'year' : 'month'}`,
          billing_cycle: billingCycle === 'annual' ? 'Annual' : 'Monthly',
          effective_date: now.toLocaleDateString(DEFAULT_LOCALE),
        },
      }).catch((err) => {
        this.logger.warn(`Failed to send upgrade email: ${err.message}`);
      });
    }

    // Sync plan change to SCC
    await this.sccSync.syncPlanChange(updated.slug, 'active', null, newPlan);

    this.logger.log(`Studio ${studioId} upgraded from ${oldPlan} to ${newPlan}`);
    return updated;
  }

  /**
   * Clear tenant-scoped data (members, branches, or all).
   * Runs within the current tenant schema context set by TenantMiddleware.
   */
  async clearTenantData(studioId: string, options: { members?: boolean; branches?: boolean; all?: boolean }) {
    const studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new NotFoundException('Studio not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const counts: Record<string, number> = {};

      if (options.all || options.members) {
        // Delete member sub-records first (FK constraints)
        await tx.memberTagAssignment.deleteMany({});
        await tx.memberDocument.deleteMany({});
        await tx.memberNote.deleteMany({});
        await tx.memberProgressPhoto.deleteMany({});
        await tx.memberBodyStats.deleteMany({});
        await tx.memberMembership.deleteMany({});
        await tx.memberProfile.deleteMany({});
        await tx.memberReferral.deleteMany({});
        // Delete check-ins and class enrollments
        await tx.checkIn.deleteMany({});
        await tx.classEnrollment.deleteMany({});
        await tx.classBooking.deleteMany({});
        await tx.classAttendance.deleteMany({});
        // Delete financial transactions and payments linked to members
        await tx.financialTransaction.deleteMany({});
        await tx.payment.deleteMany({});
        // Delete members
        const deletedMembers = await tx.member.deleteMany({});
        counts.members = deletedMembers.count;
      }

      if (options.all || options.branches) {
        // Delete branch-related data
        await tx.expense.deleteMany({});
        await tx.classWaitlist.deleteMany({});
        await tx.classSession.deleteMany({});
        await tx.class.deleteMany({});
        await tx.membershipPlan.deleteMany({});
        await tx.branchSettings.deleteMany({});
        await tx.staff.deleteMany({});
        const deletedBranches = await tx.branch.deleteMany({});
        counts.branches = deletedBranches.count;
      }

      return counts;
    });

    this.logger.log(`Cleared tenant data for studio ${studioId}: ${JSON.stringify(result)}`);
    return { cleared: true, counts: result };
  }
}
