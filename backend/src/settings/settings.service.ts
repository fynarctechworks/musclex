import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLAN_CONFIGS,
  fetchAvailablePlans,
} from '../common/plan-configs';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

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

    const planConfig = PLAN_CONFIGS[studio.subscription_plan] || PLAN_CONFIGS.free;

    // Fetch usage counts
    const [branchCount, memberCount, staffCount] = await Promise.all([
      this.prisma.branch.count({ where: { is_active: true } }),
      this.prisma.member.count({ where: { status: 'active' } }),
      this.prisma.staff.count({ where: { is_active: true } }),
    ]);

    return {
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
        status: studio.subscription_status,
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
      },
      usage: {
        branches: { current: branchCount, max: planConfig.max_branches },
        members: { current: memberCount, max: planConfig.max_members },
        staff: { current: staffCount, max: planConfig.max_staff },
        storage_limit_gb: planConfig.storage_limit_gb,
        api_access: planConfig.api_access,
      },
      features: planConfig.features,
      billing: {
        billing_name: studio.billing_name,
        billing_email: studio.billing_email,
        billing_address: studio.billing_address,
        tax_id: studio.tax_id,
        currency: studio.currency,
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

  async getBranchSummary() {
    const branches = await this.prisma.branch.findMany({
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
    },
  ) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    return this.prisma.studio.update({
      where: { id: studioId },
      data,
    });
  }
}
