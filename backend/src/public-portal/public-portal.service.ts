import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { MembersService } from '../members/members.service';
import { LeadsService } from '../marketing/leads.service';
import { PaymentsService } from '../payments/payments.service';
import { RazorpayService } from '../payments/razorpay.service';
import { PublicCheckoutDto, PublicCheckoutVerifyDto, PublicLeadDto } from './dto';

/**
 * Unauthenticated per-gym self-serve portal ("24×7 front desk"):
 *   - public gym profile by slug (identity, branches, active plans, classes)
 *   - prospect sign-up / trial booking → Lead (fires lead_created automations)
 *   - online plan purchase → Member (status lead) + Razorpay order, activated
 *     by the existing verify/webhook path
 *
 * SECURITY MODEL: the slug is the only client input used for tenant
 * resolution — it maps to the registry (public.studios) and every gym-scoped
 * query runs inside runForGym(studio.id). Nothing here trusts a client-sent
 * gym/branch/member id without a tenant-scoped existence check, and verify
 * derives member/plan/branch from the server-side pending payment row, never
 * from the client.
 */
@Injectable()
export class PublicPortalService {
  private readonly logger = new Logger(PublicPortalService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
    private readonly members: MembersService,
    private readonly leads: LeadsService,
    private readonly payments: PaymentsService,
    private readonly razorpay: RazorpayService,
  ) {}

  // ────────────────────────────────────────────────────────────────

  async gymProfile(slug: string) {
    const studio = await this.resolveStudio(slug);

    const data = await this.tasks.runForGym(studio.id, async () => {
      const [branches, plans] = await Promise.all([
        this.tenant.client.branch.findMany({
          where: { is_active: true, status: { in: ['active', 'coming_soon'] } },
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            phone: true,
            opening_time: true,
            closing_time: true,
            latitude: true,
            longitude: true,
          },
          orderBy: { created_at: 'asc' },
        }),
        this.tenant.client.membershipPlan.findMany({
          where: { is_active: true },
          select: {
            id: true,
            name: true,
            description: true,
            plan_type: true,
            duration_days: true,
            total_classes: true,
            price: true,
            currency: true,
            branch_id: true,
            tier: true,
          },
          orderBy: { price: 'asc' },
        }),
      ]);
      return { branches, plans };
    });
    if (!data) throw new ServiceUnavailableException('Gym is not available right now');

    return {
      gym: {
        slug: studio.slug,
        name: studio.name,
        tagline: studio.tagline,
        logo_url: studio.logo_url,
        phone: studio.phone,
        email: studio.email,
        website: studio.website,
        address: studio.address,
        city: studio.city,
        state: studio.state,
      },
      branches: data.branches,
      plans: data.plans.map((p) => ({ ...p, price: Number(p.price) })),
    };
  }

  async upcomingClasses(slug: string, branchId?: string) {
    const studio = await this.resolveStudio(slug);
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 86400000);

    const classes = await this.tasks.runForGym(studio.id, () =>
      this.tenant.client.class.findMany({
        where: {
          status: 'scheduled',
          starts_at: { gte: now, lt: weekOut },
          ...(branchId ? { branch_id: branchId } : {}),
        },
        select: {
          id: true,
          name: true,
          category: true,
          starts_at: true,
          duration_minutes: true,
          capacity: true,
          branch_id: true,
          trainer: { select: { full_name: true } },
          _count: { select: { enrollments: { where: { status: 'enrolled' } } } },
        },
        orderBy: { starts_at: 'asc' },
        take: 50,
      }),
    );

    return (classes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      starts_at: c.starts_at,
      duration_minutes: c.duration_minutes,
      branch_id: c.branch_id,
      trainer_name: c.trainer?.full_name ?? null,
      spots_left: Math.max(0, c.capacity - c._count.enrollments),
    }));
  }

  // ────────────────────────────────────────────────────────────────

  async createLead(slug: string, dto: PublicLeadDto) {
    const studio = await this.resolveStudio(slug);

    const result = await this.tasks.runForGym(studio.id, async () => {
      if (dto.branch_id) {
        const branch = await this.tenant.client.branch.findFirst({
          where: { id: dto.branch_id },
          select: { id: true },
        });
        if (!branch) throw new BadRequestException('Unknown branch');
      }

      const isTrial = dto.intent === 'trial';
      const lead = await this.leads.create({
        full_name: dto.full_name,
        phone: dto.phone,
        email: dto.email,
        branch_id: dto.branch_id,
        lead_source: 'website',
        notes: dto.notes,
      } as any);

      if (isTrial) {
        await this.tenant.client.lead.update({
          where: { id: lead.id },
          data: { status: 'trial_scheduled' },
        });
        await this.tenant.client.leadActivity.create({
          data: {
            gym_id: studio.id,
            lead_id: lead.id,
            activity_type: 'trial_booking',
            notes: `Trial requested via public portal${dto.preferred_date ? ` — preferred date ${dto.preferred_date}` : ''}`,
          },
        });
      }

      return { lead_id: lead.id, status: isTrial ? 'trial_scheduled' : 'new' };
    });

    if (!result) throw new ServiceUnavailableException('Gym is not available right now');
    return { ...result, message: 'Thanks! The gym will contact you shortly.' };
  }

  // ────────────────────────────────────────────────────────────────

  async checkout(slug: string, dto: PublicCheckoutDto) {
    const studio = await this.resolveStudio(slug);

    const result = await this.tasks.runForGym(studio.id, async () => {
      const plan = await this.tenant.client.membershipPlan.findFirst({
        where: { id: dto.plan_id, is_active: true },
        select: { id: true },
      });
      if (!plan) throw new BadRequestException('Unknown or inactive plan');

      const branch = await this.tenant.client.branch.findFirst({
        where: { id: dto.branch_id, is_active: true },
        select: { id: true },
      });
      if (!branch) throw new BadRequestException('Unknown branch');

      // Existing member (same phone) buys again → reuse their record;
      // otherwise create a lead-status member that verify() activates.
      const normalizedPhone = dto.phone.replace(/[\s-]/g, '');
      let member = await this.tenant.client.member.findFirst({
        where: { phone: normalizedPhone, status: { not: 'cancelled' } },
        select: { id: true },
      });
      if (!member) {
        // Full member-creation path (limits, duplicate checks, MEMBER_CREATED
        // event, member-app directory sync). Returns { ...member, membership }.
        const created = await this.members.create(studio.id, {
          full_name: dto.full_name,
          phone: normalizedPhone,
          email: dto.email,
          branch_id: dto.branch_id,
          status: 'lead',
        } as any);
        member = { id: (created as any).id };
      }

      const order = await this.payments.createOrder(studio.id, {
        member_id: member.id,
        plan_id: dto.plan_id,
        branch_id: dto.branch_id,
      });

      return {
        order_id: order.order_id,
        key_id: order.key_id,
        amount: order.amount,
        currency: order.currency,
        plan_name: order.plan_name,
        member_id: member.id,
      };
    });

    if (!result) throw new ServiceUnavailableException('Gym is not available right now');
    return result;
  }

  /**
   * Hosted-checkout context for the member app's renewal flow: the app creates
   * an order via the BFF, then opens /pay/<order_id> in the browser; that page
   * calls this to render Razorpay Checkout. The Razorpay order id is treated
   * as an unguessable capability token; only PENDING orders resolve, and only
   * public-safe display fields leave the server. Verification then reuses the
   * standard slug-scoped verify (server-derived member/plan/branch).
   */
  async orderContext(orderId: string) {
    if (!/^order_[A-Za-z0-9]{8,32}$/.test(orderId)) {
      throw new NotFoundException('Order not found');
    }
    // Resolve the owning gym from the gateway's server-set notes.
    const gatewayOrder = await this.razorpay.getOrder(orderId).catch(() => null);
    const gymId = (gatewayOrder?.notes as Record<string, string> | undefined)?.gym_id;
    if (!gymId) throw new NotFoundException('Order not found');

    const studio = await this.pub.studio.findUnique({
      where: { id: gymId },
      select: { slug: true, name: true, logo_url: true, suspended_at: true },
    });
    if (!studio || studio.suspended_at) throw new NotFoundException('Order not found');

    const context = await this.tasks.runForGym(gymId, async () => {
      const payment = await this.tenant.client.payment.findFirst({
        where: { gateway_order_id: orderId, status: 'pending' },
        select: { amount: true, currency: true },
      });
      if (!payment) return null;
      const planId = (gatewayOrder!.notes as Record<string, string>).plan_id;
      const plan = planId
        ? await this.tenant.client.membershipPlan.findFirst({
            where: { id: planId },
            select: { name: true },
          })
        : null;
      const creds = await this.tenant.client.paymentGatewayConfig.findFirst({
        where: { gateway_name: 'razorpay', is_active: true },
        select: { api_key: true, secret_key: true },
      });
      return {
        amount: Number(payment.amount),
        currency: payment.currency,
        plan_name: plan?.name ?? null,
        key_id: this.razorpay.getKeyId(
          creds?.api_key && creds?.secret_key
            ? { keyId: creds.api_key, keySecret: creds.secret_key }
            : undefined,
        ),
      };
    });
    if (!context) throw new NotFoundException('Order not found');

    return {
      order_id: orderId,
      slug: studio.slug,
      gym_name: studio.name,
      gym_logo_url: studio.logo_url,
      amount: context.amount,
      currency: context.currency,
      plan_name: context.plan_name,
      key_id: context.key_id,
    };
  }

  async verifyCheckout(slug: string, dto: PublicCheckoutVerifyDto) {
    const studio = await this.resolveStudio(slug);

    const result = await this.tasks.runForGym(studio.id, async () => {
      // verifyPayment self-derives member/branch (from the pending Payment row)
      // and plan (from the gateway order notes) and enforces amount==price — so
      // we pass ONLY the three signature fields. Nothing here is client-trusted.
      return this.payments.verifyPayment({
        gateway_payment_id: dto.gateway_payment_id,
        gateway_order_id: dto.gateway_order_id,
        signature: dto.signature,
      });
    });

    if (!result) throw new ServiceUnavailableException('Gym is not available right now');
    return { success: true, message: 'Payment verified — membership activated. See you at the gym!' };
  }

  // ────────────────────────────────────────────────────────────────

  private async resolveStudio(slug: string) {
    const studio = await this.pub.studio.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        logo_url: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        city: true,
        state: true,
        suspended_at: true,
      },
    });
    if (!studio) throw new NotFoundException('Gym not found');
    if (studio.suspended_at) throw new NotFoundException('Gym not found');
    return studio;
  }
}
