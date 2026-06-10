import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import {
  AuditAction,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
} from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { CreateSubscriptionDto, SubscriptionFilterDto } from './dto/subscription.dto';
import { REDIS_CLIENT } from '../../config/redis.module';
import { withCronLock } from '../../common/utils/cron-lock';
import {
  BILLING_GATEWAY,
  BillingGateway,
} from '../billing/gateway/billing-gateway.interface';

const RENEWAL_PERIOD_DAYS = 30;
const RENEWAL_LOCK_TTL_SEC = 600; // 10 min upper bound per cron tick

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    @Inject(BILLING_GATEWAY) private gateway: BillingGateway,
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
    const [tenant, plan] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: dto.tenant_id } }),
      this.prisma.subscriptionPlan.findUnique({ where: { id: dto.plan_id } }),
    ]);

    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!plan || !plan.is_active) throw new BadRequestException('Invalid or inactive plan');

    await this.prisma.subscription.updateMany({
      where: { tenant_id: dto.tenant_id, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELED, canceled_at: new Date() },
    });

    const startDate = dto.start_date ? new Date(dto.start_date) : new Date();
    const endDate = dto.end_date
      ? new Date(dto.end_date)
      : new Date(startDate.getTime() + RENEWAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

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
    }

    this.logger.log(`Expired ${expiredTrials.length} trials`);
  }

  // ── Subscription expirations + auto-renewal ──────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpirations() {
    await withCronLock(
      this.redis,
      'subscription:handleExpirations',
      RENEWAL_LOCK_TTL_SEC,
      () => this.runExpirationsAndRenewals(),
    );
  }

  /**
   * Inner cron body — invoked under the distributed lock so two instances
   * can't double-renew or double-expire the same subscription. Exposed for
   * tests; production code path is always `handleExpirations`.
   */
  async runExpirationsAndRenewals(): Promise<void> {
    this.logger.log('Running subscription expiration check...');
    const now = new Date();

    const due = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        end_date: { lt: now },
      },
      include: { tenant: true, plan: true },
    });

    for (const sub of due) {
      if (sub.auto_renew) {
        await this.attemptAutoRenewal(sub, now);
      } else {
        await this.expireSubscription(sub);
      }
    }
  }

  private async attemptAutoRenewal(
    sub: Prisma.SubscriptionGetPayload<{ include: { tenant: true; plan: true } }>,
    now: Date,
  ): Promise<void> {
    // Always record the renewal attempt as a PENDING Payment first, linked to
    // the subscription. This fixes the M1 partial regression where prior code
    // stuffed subscription_id into metadata rather than the FK column.
    const payment = await this.prisma.payment.create({
      data: {
        tenant_id: sub.tenant_id,
        subscription_id: sub.id,
        amount: sub.plan.price_monthly,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        gateway: this.gateway.name,
        metadata: { kind: 'auto_renewal', period_days: RENEWAL_PERIOD_DAYS } as Prisma.InputJsonValue,
      },
    });

    const customerToken = this.extractCustomerToken(sub.tenant.metadata);

    const result = await this.gateway.charge({
      amount: Number(sub.plan.price_monthly),
      currency: 'INR',
      tenant_id: sub.tenant_id,
      payment_id: payment.id,
      description: `Auto-renewal for tenant ${sub.tenant.slug}`,
      customer_token: customerToken,
    });

    if (result.status === 'PAID') {
      const newEnd = new Date(now.getTime() + RENEWAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            gateway_payment_id: result.gateway_payment_id,
          },
        }),
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            start_date: now,
            end_date: newEnd,
          },
        }),
      ]);
      this.logger.log(
        JSON.stringify({
          event: 'payment.paid',
          kind: 'auto_renewal',
          subscription_id: sub.id,
          tenant_id: sub.tenant_id,
          payment_id: payment.id,
          gateway: this.gateway.name,
          gateway_payment_id: result.gateway_payment_id,
          amount: Number(sub.plan.price_monthly),
          new_end_date: newEnd.toISOString(),
        }),
      );
      return;
    }

    // PENDING or FAILED — DO NOT extend dates. Flip the subscription to
    // PAST_DUE so the dashboard can surface a "needs attention" counter, but
    // leave Tenant.status = ACTIVE (per decision: no auto-suspend).
    const persistedPaymentStatus =
      result.status === 'PENDING' ? PaymentStatus.PENDING : PaymentStatus.FAILED;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: persistedPaymentStatus,
          gateway_payment_id: result.gateway_payment_id ?? null,
          failure_reason: result.failure_reason ?? null,
        },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      }),
    ]);

    this.logger.warn(
      JSON.stringify({
        event: 'payment.failed',
        kind: 'auto_renewal',
        subscription_id: sub.id,
        tenant_id: sub.tenant_id,
        payment_id: payment.id,
        gateway: this.gateway.name,
        outcome: result.status,
        failure_reason: result.failure_reason,
        next_state: 'PAST_DUE',
        amount: Number(sub.plan.price_monthly),
      }),
    );
  }

  private async expireSubscription(
    sub: Prisma.SubscriptionGetPayload<{ include: { tenant: true; plan: true } }>,
  ): Promise<void> {
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

  private extractCustomerToken(metadata: Prisma.JsonValue | null): string | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    const token = (metadata as Record<string, unknown>).gateway_customer_token;
    return typeof token === 'string' && token.length > 0 ? token : undefined;
  }
}
