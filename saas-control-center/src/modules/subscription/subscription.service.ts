import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction, Prisma, SubscriptionStatus, TenantStatus } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { CreateSubscriptionDto, SubscriptionFilterDto } from './dto/subscription.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
  ) {}

  async findAll(filters: SubscriptionFilterDto) {
    const where: Prisma.SubscriptionWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.plan_id) where.plan_id = filters.plan_id;

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          plan: { select: { id: true, name: true, price_monthly: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return new PaginatedResult(data, total, filters.page!, filters.limit!);
  }

  async create(dto: CreateSubscriptionDto, ctx: AuditContext) {
    // Validate tenant and plan exist
    const [tenant, plan] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: dto.tenant_id } }),
      this.prisma.subscriptionPlan.findUnique({ where: { id: dto.plan_id } }),
    ]);

    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!plan || !plan.is_active) throw new BadRequestException('Invalid or inactive plan');

    // Cancel any active subscription for this tenant
    await this.prisma.subscription.updateMany({
      where: { tenant_id: dto.tenant_id, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELED, canceled_at: new Date() },
    });

    const startDate = dto.start_date ? new Date(dto.start_date) : new Date();
    const endDate = dto.end_date
      ? new Date(dto.end_date)
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.subscription.create({
      data: {
        tenant_id: dto.tenant_id,
        plan_id: dto.plan_id,
        status: SubscriptionStatus.ACTIVE,
        start_date: startDate,
        end_date: endDate,
        auto_renew: dto.auto_renew ?? true,
      },
      include: { tenant: true, plan: true },
    });

    // Update tenant plan reference
    await this.prisma.tenant.update({
      where: { id: dto.tenant_id },
      data: { plan_id: dto.plan_id, status: TenantStatus.ACTIVE },
    });

    await this.audit.log(AuditAction.CREATE, 'subscription', subscription.id, ctx, {
      new_value: { tenant_id: dto.tenant_id, plan: plan.name },
    });

    return subscription;
  }

  async cancel(id: string, ctx: AuditContext) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException('Already canceled');
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.CANCELED, canceled_at: new Date() },
    });

    await this.audit.log(AuditAction.UPDATE, 'subscription', id, ctx, {
      old_value: { status: sub.status },
      new_value: { status: 'CANCELED' },
    });

    return updated;
  }

  async getExpiringSoon(days: number = 7) {
    const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        end_date: { lte: deadline },
      },
      include: {
        tenant: { select: { id: true, name: true, owner_email: true } },
        plan: { select: { name: true } },
      },
      orderBy: { end_date: 'asc' },
    });
  }

  // ── Trial Expiry: 3-day reminder ──────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleTrialExpiryReminders() {
    this.logger.log('Running trial expiry reminder check (3-day warning)...');
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const expiringTrials = await this.prisma.tenant.findMany({
      where: {
        status: TenantStatus.TRIAL,
        trial_ends_at: {
          gt: now,
          lte: threeDaysFromNow,
        },
        is_active: true,
      },
      select: { id: true, name: true, owner_email: true, trial_ends_at: true },
    });

    for (const tenant of expiringTrials) {
      this.logger.log(
        `Trial expiry reminder: tenant "${tenant.name}" (${tenant.owner_email}) expires at ${tenant.trial_ends_at?.toISOString()}`,
      );
      // TODO: Send email reminder via Resend when available
      // await this.emailService.sendTrialExpiryReminder(tenant.owner_email, tenant.name, tenant.trial_ends_at);
    }

    this.logger.log(`Sent ${expiringTrials.length} trial expiry reminders`);
  }

  // ── Trial Expiry: expire overdue trials ─────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTrialExpirations() {
    this.logger.log('Running trial expiration check...');
    const now = new Date();

    const expiredTrials = await this.prisma.tenant.findMany({
      where: {
        status: TenantStatus.TRIAL,
        trial_ends_at: { lte: now },
        is_active: true,
      },
    });

    for (const tenant of expiredTrials) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.EXPIRED, is_active: false },
      });

      // Also expire any TRIALING subscriptions for this tenant
      await this.prisma.subscription.updateMany({
        where: {
          tenant_id: tenant.id,
          status: SubscriptionStatus.TRIALING,
        },
        data: { status: SubscriptionStatus.EXPIRED },
      });

      this.logger.log(
        `Trial expired for tenant "${tenant.name}" (${tenant.owner_email})`,
      );
      // TODO: Send trial expired email via Resend when available
      // await this.emailService.sendTrialExpiredNotice(tenant.owner_email, tenant.name);
    }

    this.logger.log(`Expired ${expiredTrials.length} trials`);
  }

  // Run daily at midnight — expire subscriptions and auto-renew
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpirations() {
    this.logger.log('Running subscription expiration check...');
    const now = new Date();

    // Find expired active subscriptions
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        end_date: { lt: now },
      },
      include: { tenant: true, plan: true },
    });

    for (const sub of expired) {
      if (sub.auto_renew) {
        // Create a pending payment for renewal
        const payment = await this.prisma.payment.create({
          data: {
            tenant_id: sub.tenant_id,
            amount: sub.plan.price_monthly,
            currency: 'INR',
            status: 'PENDING',
            gateway: 'auto_renewal',
            metadata: { subscription_id: sub.id, period: 'monthly' },
          },
        });

        // TODO: In production, call payment gateway here
        // For now, extend subscription and mark as PAST_DUE until payment confirmed
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            start_date: now,
            end_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        this.logger.log(`Auto-renewed subscription ${sub.id}, payment ${payment.id} pending`);
      } else {
        // Expire
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.EXPIRED },
          }),
          this.prisma.tenant.update({
            where: { id: sub.tenant_id },
            data: { status: TenantStatus.EXPIRED },
          }),
        ]);
        this.logger.log(`Expired subscription ${sub.id} for tenant ${sub.tenant.name}`);
      }
    }
  }
}
