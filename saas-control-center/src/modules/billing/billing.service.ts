import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction, PaymentStatus, Prisma } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { RecordPaymentDto, PaymentFilterDto } from './dto/billing.dto';
import { IdempotencyService } from './idempotency.service';
import {
  BILLING_GATEWAY,
  BillingGateway,
} from './gateway/billing-gateway.interface';

const MAX_RETRIES = 3;

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
    private idempotency: IdempotencyService,
    @Inject(BILLING_GATEWAY) private gateway: BillingGateway,
  ) {}

  async findAll(filters: PaymentFilterDto) {
    const where: Prisma.PaymentWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.gateway) where.gateway = filters.gateway;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return new PaginatedResult(data, total, filters.page!, filters.limit!);
  }

  /**
   * Full billing picture for one tenant, assembled for the SCC /billing drawer:
   *  • SCC subscription + plan (scc schema)
   *  • Billing profile + lifecycle (main app public.studios, matched by slug)
   *  • Every SaaS invoice (main app public.invoices)
   *  • Every SCC payment (scc.payments)
   *  • A derived summary + an "issues" list surfacing pending/overdue/missing items
   *
   * Cross-schema reads use parameterized $queryRawUnsafe on the same connection
   * (same approach as TenantService.getOperationalDetail) and are individually
   * fault-tolerant — a missing main-app row never blanks the whole panel.
   */
  async getTenantBillingDetail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: { select: { id: true, name: true, price_monthly: true, price_yearly: true } },
        subscriptions: true, // unique per tenant → 0 or 1
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const subscription = tenant.subscriptions?.[0] ?? null;

    // Billing profile + lifecycle from the main app, matched by the stable slug.
    const studioRows = await this.safeRaw<StudioBillingRow>(
      `SELECT id, billing_name, billing_email, billing_address, tax_id, gstin,
              business_name, currency, billing_cycle, subscription_plan,
              subscription_status, lifecycle_status, subscription_start,
              subscription_expires_at, next_billing_date, trial_ends_at,
              grace_until, locked_at, suspended_at
       FROM public.studios WHERE slug = $1 LIMIT 1`,
      [tenant.slug],
    );
    const studio = studioRows?.[0] ?? null;

    // Every SaaS billing invoice for this gym.
    const invoiceRows = studio
      ? (await this.safeRaw<InvoiceRow>(
          `SELECT id, invoice_number, amount::float AS amount, currency, status,
                  billing_period_start, billing_period_end, paid_at, invoice_url, created_at
           FROM public.invoices WHERE studio_id = $1::uuid ORDER BY created_at DESC`,
          [studio.id],
        )) ?? []
      : [];

    // Every SCC payment mirrored for this tenant.
    const paymentRows = await this.prisma.payment.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
    const payments = paymentRows.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));

    // ── Derived summary ──────────────────────────────────────────────
    const now = new Date();
    const paidPayments = payments.filter((p) => p.status === 'PAID');
    const summary = {
      total_paid: paidPayments.reduce((s, p) => s + p.amount, 0),
      paid_count: paidPayments.length,
      pending_count: payments.filter((p) => p.status === 'PENDING').length,
      failed_count: payments.filter((p) => p.status === 'FAILED').length,
      refunded_count: payments.filter((p) => p.status === 'REFUNDED').length,
      invoice_count: invoiceRows.length,
      last_payment_at: paidPayments[0]?.created_at ?? null,
      currency: studio?.currency || payments[0]?.currency || 'INR',
    };

    // ── Pending & missing things ─────────────────────────────────────
    const issues: BillingIssue[] = [];
    const push = (severity: BillingIssue['severity'], code: string, title: string, detail?: string) =>
      issues.push({ severity, code, title, detail });

    if (!studio) {
      push(
        'warning',
        'not_linked',
        'Not linked to a live gym',
        'This is a manually-created tenant with no studio in the main app — billing profile and invoices are unavailable.',
      );
    } else {
      // Lifecycle / subscription health.
      switch (studio.lifecycle_status) {
        case 'locked':
          push('error', 'locked', 'Subscription locked', 'The gym is past its grace period and access is blocked until payment.');
          break;
        case 'grace_period':
          push('warning', 'grace_period', 'In grace period', studio.grace_until ? `Grace ends ${new Date(studio.grace_until).toLocaleDateString('en-IN')}.` : undefined);
          break;
        case 'expired':
          push('error', 'expired', 'Subscription expired');
          break;
        case 'suspended':
          push('error', 'suspended', 'Account suspended');
          break;
      }
      if ((studio.subscription_status || '').toLowerCase() === 'past_due') {
        push('warning', 'past_due', 'Subscription marked past due');
      }
      if (studio.next_billing_date && new Date(studio.next_billing_date) < now &&
          !['locked', 'grace_period', 'expired'].includes(studio.lifecycle_status ?? '')) {
        push('warning', 'billing_overdue', 'Next billing date has passed',
          `Was due ${new Date(studio.next_billing_date).toLocaleDateString('en-IN')}.`);
      }

      // Billing-profile completeness.
      const missing: string[] = [];
      if (!studio.billing_name) missing.push('billing name');
      if (!studio.billing_email) missing.push('billing email');
      if (!studio.billing_address) missing.push('billing address');
      if (missing.length) {
        push('warning', 'profile_incomplete', 'Billing profile incomplete', `Missing: ${missing.join(', ')}.`);
      }
      if (!studio.tax_id && !studio.gstin) {
        push('info', 'no_tax_id', 'No GST / Tax ID on file', 'Invoices will be issued without a tax identifier.');
      }
      if (invoiceRows.length === 0) {
        push('info', 'no_invoices', 'No invoices generated yet');
      }
    }

    // Payment-state issues (independent of studio linkage).
    if (summary.failed_count > 0) {
      push('error', 'failed_payments', `${summary.failed_count} failed payment(s)`, 'Retry or mark paid from the payments list.');
    }
    if (summary.pending_count > 0) {
      push('warning', 'pending_payments', `${summary.pending_count} pending payment(s)`);
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        owner_email: tenant.owner_email,
        owner_name: tenant.owner_name,
        phone: tenant.phone,
        plan: tenant.plan,
      },
      subscription,
      billing_info: studio
        ? {
            billing_name: studio.billing_name,
            billing_email: studio.billing_email,
            billing_address: studio.billing_address,
            tax_id: studio.tax_id,
            gstin: studio.gstin,
            business_name: studio.business_name,
            currency: studio.currency,
            billing_cycle: studio.billing_cycle,
          }
        : null,
      lifecycle: studio
        ? {
            plan: studio.subscription_plan,
            status: studio.lifecycle_status,
            subscription_status: studio.subscription_status,
            subscription_start: studio.subscription_start,
            subscription_expires_at: studio.subscription_expires_at,
            next_billing_date: studio.next_billing_date,
            trial_ends_at: studio.trial_ends_at,
            grace_until: studio.grace_until,
            locked_at: studio.locked_at,
            suspended_at: studio.suspended_at,
          }
        : null,
      invoices: invoiceRows,
      payments,
      summary,
      issues,
    };
  }

  /** Parameterized raw read, swallowing failures (missing/empty table) → null. */
  private async safeRaw<T = any>(sql: string, params: any[] = []): Promise<T[] | null> {
    try {
      return await this.prisma.$queryRawUnsafe<T[]>(sql, ...params);
    } catch {
      return null;
    }
  }

  async recordPayment(dto: RecordPaymentDto, ctx: AuditContext) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenant_id },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const payment = await this.prisma.payment.create({
      data: {
        tenant_id: dto.tenant_id,
        amount: dto.amount,
        currency: dto.currency || 'INR',
        status: PaymentStatus.PAID,
        gateway: dto.gateway || 'manual',
        gateway_payment_id: dto.gateway_payment_id,
      },
    });

    await this.audit.log(AuditAction.CREATE, 'payment', payment.id, ctx, {
      new_value: { tenant: tenant.name, amount: dto.amount },
    });

    return payment;
  }

  async retryPayment(id: string, idempotencyKey: string, ctx: AuditContext) {
    return this.withIdempotency(
      idempotencyKey,
      'POST /billing/payments/:id/retry',
      { id },
      ctx.admin_id,
      async () => {
        const payment = await this.prisma.payment.findUnique({ where: { id } });
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.status !== PaymentStatus.FAILED) {
          throw new BadRequestException('Only failed payments can be retried');
        }
        if (payment.retry_count >= MAX_RETRIES) {
          throw new BadRequestException(`Max retries (${MAX_RETRIES}) exceeded`);
        }

        const result = await this.gateway.charge({
          amount: Number(payment.amount),
          currency: payment.currency,
          tenant_id: payment.tenant_id,
          payment_id: payment.id,
          description: `Retry of payment ${payment.id}`,
          customer_token: this.extractCustomerToken(payment.metadata),
        });

        if (result.status === 'PAID') {
          const updated = await this.prisma.payment.update({
            where: { id },
            data: {
              status: PaymentStatus.PAID,
              gateway: this.gateway.name,
              gateway_payment_id: result.gateway_payment_id ?? payment.gateway_payment_id,
              failure_reason: null,
              retry_count: { increment: 1 },
            },
          });
          await this.audit.log(AuditAction.PAYMENT_RETRY, 'payment', id, ctx, {
            metadata: {
              retry_count: updated.retry_count,
              idempotency_key: idempotencyKey,
              gateway: this.gateway.name,
              outcome: 'PAID',
              gateway_payment_id: result.gateway_payment_id,
            },
          });
          return updated;
        }

        // PENDING or FAILED — bump retry, surface failure reason, keep status sensible.
        const persistedStatus =
          result.status === 'PENDING' ? PaymentStatus.PENDING : PaymentStatus.FAILED;
        const updated = await this.prisma.payment.update({
          where: { id },
          data: {
            status: persistedStatus,
            gateway: this.gateway.name,
            gateway_payment_id: result.gateway_payment_id ?? payment.gateway_payment_id,
            failure_reason: result.failure_reason ?? payment.failure_reason,
            retry_count: { increment: 1 },
          },
        });
        await this.audit.log(AuditAction.PAYMENT_RETRY, 'payment', id, ctx, {
          metadata: {
            retry_count: updated.retry_count,
            idempotency_key: idempotencyKey,
            gateway: this.gateway.name,
            outcome: result.status,
            failure_reason: result.failure_reason,
          },
        });
        return updated;
      },
    );
  }

  async markAsPaid(id: string, idempotencyKey: string, ctx: AuditContext) {
    return this.withIdempotency(
      idempotencyKey,
      'POST /billing/payments/:id/mark-paid',
      { id },
      ctx.admin_id,
      async () => {
        const payment = await this.prisma.payment.findUnique({ where: { id } });
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.status === PaymentStatus.PAID) {
          throw new BadRequestException('Payment is already marked as paid');
        }

        const updated = await this.prisma.payment.update({
          where: { id },
          data: { status: PaymentStatus.PAID },
        });

        await this.audit.log(AuditAction.UPDATE, 'payment', id, ctx, {
          old_value: { status: payment.status },
          new_value: { status: 'PAID' },
          metadata: { idempotency_key: idempotencyKey },
        });

        return updated;
      },
    );
  }

  async refund(id: string, idempotencyKey: string, ctx: AuditContext) {
    return this.withIdempotency(
      idempotencyKey,
      'POST /billing/payments/:id/refund',
      { id },
      ctx.admin_id,
      async () => {
        const payment = await this.prisma.payment.findUnique({ where: { id } });
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.status !== PaymentStatus.PAID) {
          throw new BadRequestException('Only paid payments can be refunded');
        }

        // Only call the gateway when a gateway payment id exists. Manually
        // recorded payments (gateway='manual', no gateway_payment_id) are
        // bookkeeping-only and can be flipped to REFUNDED without an external call.
        let gatewayRefundId: string | undefined;
        if (payment.gateway_payment_id) {
          const result = await this.gateway.refund({
            gateway_payment_id: payment.gateway_payment_id,
            amount: Number(payment.amount),
            currency: payment.currency,
            reason: `Refund initiated by admin ${ctx.admin_id}`,
          });
          if (result.status === 'FAILED') {
            throw new BadRequestException(
              `Gateway refund failed: ${result.failure_reason ?? 'unknown error'}`,
            );
          }
          gatewayRefundId = result.gateway_refund_id;
        }

        const updated = await this.prisma.payment.update({
          where: { id },
          data: { status: PaymentStatus.REFUNDED },
        });

        await this.audit.log(AuditAction.REFUND, 'payment', id, ctx, {
          metadata: {
            amount: payment.amount,
            currency: payment.currency,
            idempotency_key: idempotencyKey,
            gateway: payment.gateway,
            gateway_refund_id: gatewayRefundId,
          },
        });

        return updated;
      },
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Reserves an idempotency row, runs the operation, persists the canonical
   * response. On replay, returns the persisted response without re-executing.
   * On failure inside `fn`, releases the reservation so the client can retry.
   */
  private async withIdempotency<T>(
    key: string,
    endpoint: string,
    params: Record<string, unknown>,
    adminId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const requestHash = this.idempotency.hashRequest(endpoint, params);
    const check = await this.idempotency.checkOrReserve<T>(
      key,
      endpoint,
      requestHash,
      adminId,
    );
    if (check.replayed) return check.response as T;

    try {
      const result = await fn();
      await this.idempotency.saveResponse(key, result);
      return result;
    } catch (err) {
      await this.idempotency.release(key);
      throw err;
    }
  }

  private extractCustomerToken(metadata: Prisma.JsonValue | null): string | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    const token = (metadata as Record<string, unknown>).customer_token;
    return typeof token === 'string' && token.length > 0 ? token : undefined;
  }
}

export interface BillingIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  title: string;
  detail?: string;
}

interface StudioBillingRow {
  id: string;
  billing_name: string | null;
  billing_email: string | null;
  billing_address: string | null;
  tax_id: string | null;
  gstin: string | null;
  business_name: string | null;
  currency: string | null;
  billing_cycle: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  lifecycle_status: string | null;
  subscription_start: Date | null;
  subscription_expires_at: Date | null;
  next_billing_date: Date | null;
  trial_ends_at: Date | null;
  grace_until: Date | null;
  locked_at: Date | null;
  suspended_at: Date | null;
}

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  billing_period_start: Date | null;
  billing_period_end: Date | null;
  paid_at: Date | null;
  invoice_url: string | null;
  created_at: Date;
}
