import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CURRENCY } from '../defaults';

/**
 * SccSyncService — keeps the SaaS Control Center (scc schema) in sync
 * with the main backend (public schema).
 *
 * All methods are non-fatal (warn on failure, never throw).
 *
 * Synced data:
 *  • scc.tenants      ← public.studios  (on create / update / plan change)
 *  • scc.subscriptions ← implicit (created on plan selection)
 *  • scc.payments     ← public.invoices (SaaS billing invoices only)
 */
@Injectable()
export class SccSyncService {
  private readonly logger = new Logger(SccSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert a tenant record in scc.tenants from a Studio row.
   * Call after: studio create, studio update.
   */
  async upsertTenant(studio: {
    id: string;
    name: string;
    slug: string;
    email?: string | null;
    phone?: string | null;
    logo_url?: string | null;
    account_type?: string | null;
    subscription_plan?: string;
    subscription_status?: string;
    trial_ends_at?: Date | null;
    last_login_at?: Date | null;
    owner_full_name?: string;
  }): Promise<void> {
    try {
      const status = this.mapStatus(studio.subscription_status);
      const ownerName = studio.owner_full_name || studio.email?.split('@')[0] || 'Owner';
      const accountType = studio.account_type || 'gym';

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO scc.tenants
          (id, name, slug, owner_email, owner_name, phone, logo_url, account_type,
           status, is_active, trial_ends_at, last_active_at, created_at, updated_at)
         VALUES
          (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
           CAST($8 AS "scc"."TenantStatus"),
           true, $9, $10, now(), now())
         ON CONFLICT (slug) DO UPDATE SET
          name           = EXCLUDED.name,
          owner_email    = EXCLUDED.owner_email,
          owner_name     = EXCLUDED.owner_name,
          phone          = EXCLUDED.phone,
          logo_url       = EXCLUDED.logo_url,
          account_type   = EXCLUDED.account_type,
          status         = EXCLUDED.status,
          trial_ends_at  = EXCLUDED.trial_ends_at,
          last_active_at = EXCLUDED.last_active_at,
          updated_at     = now()`,
        studio.name,
        studio.slug,
        studio.email || '',
        ownerName,
        studio.phone ?? null,
        studio.logo_url ?? null,
        accountType,
        status,
        studio.trial_ends_at ?? null,
        studio.last_login_at ?? null,
      );
    } catch (e) {
      this.logger.warn(`SCC tenant upsert failed for slug="${studio.slug}": ${e}`);
    }
  }

  /**
   * Sync a plan change to scc.tenants and create a subscription row.
   * Call after: onboarding plan selection, settings plan change.
   */
  async syncPlanChange(
    studioSlug: string,
    subscriptionStatus: string,
    trialEndsAt: Date | null,
    planName: string,
  ): Promise<void> {
    try {
      const status = this.mapStatus(subscriptionStatus);

      // Find matching scc SubscriptionPlan by name
      const plans = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM scc.subscription_plans WHERE name = $1 AND is_active = true LIMIT 1`,
        planName,
      );
      const planId = plans[0]?.id ?? null;

      await this.prisma.$executeRawUnsafe(
        `UPDATE scc.tenants
         SET status        = CAST($1 AS "scc"."TenantStatus"),
             trial_ends_at = $2,
             plan_id       = COALESCE($3::uuid, plan_id),
             updated_at    = now()
         WHERE slug = $4`,
        status,
        trialEndsAt,
        planId,
        studioSlug,
      );

      // Upsert subscription row — update status if already exists
      if (planId) {
        const subStatus = status === 'TRIAL' ? 'TRIALING' : 'ACTIVE';
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO scc.subscriptions
            (id, tenant_id, plan_id, status, start_date, end_date, auto_renew, created_at, updated_at)
           SELECT gen_random_uuid(), t.id, $1::uuid,
                  CAST($2 AS "scc"."SubscriptionStatus"),
                  now(), $3, true, now(), now()
           FROM scc.tenants t WHERE t.slug = $4
           ON CONFLICT (tenant_id) DO UPDATE
             SET status     = CAST(EXCLUDED.status AS "scc"."SubscriptionStatus"),
                 plan_id    = EXCLUDED.plan_id,
                 updated_at = now()`,
          planId,
          subStatus,
          trialEndsAt,
          studioSlug,
        );
      }
    } catch (e) {
      this.logger.warn(`SCC plan sync failed for slug="${studioSlug}": ${e}`);
    }
  }

  /**
   * Sync a billing invoice to scc.payments.
   * Call after: invoice created or status updated in public.invoices.
   */
  async upsertPayment(invoice: {
    id: string;
    studio_slug: string;
    amount: number | bigint;
    currency: string;
    status: string;
    invoice_number?: string;
    paid_at?: Date | null;
  }): Promise<void> {
    try {
      const paymentStatus = this.mapPaymentStatus(invoice.status);

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO scc.payments
          (id, tenant_id, amount, currency, status, gateway, gateway_payment_id, created_at, updated_at)
         SELECT $1::uuid, t.id, $2, $3,
                CAST($4 AS "scc"."PaymentStatus"),
                'internal', $5, now(), now()
         FROM scc.tenants t WHERE t.slug = $6
         ON CONFLICT (id) DO UPDATE SET
          status     = EXCLUDED.status,
          updated_at = now()`,
        invoice.id,
        invoice.amount,
        invoice.currency || DEFAULT_CURRENCY,
        paymentStatus,
        invoice.invoice_number ?? invoice.id,
        invoice.studio_slug,
      );
    } catch (e) {
      this.logger.warn(`SCC payment sync failed for invoice="${invoice.id}": ${e}`);
    }
  }

  /**
   * Bump last_active_at on scc.tenants (call on user login).
   */
  async touchLastActive(studioSlug: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE scc.tenants SET last_active_at = now(), updated_at = now() WHERE slug = $1`,
        studioSlug,
      );
    } catch (e) {
      this.logger.warn(`SCC last_active touch failed for slug="${studioSlug}": ${e}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private mapStatus(subscriptionStatus?: string): string {
    switch (subscriptionStatus) {
      case 'active':    return 'ACTIVE';
      case 'trial':     return 'TRIAL';
      case 'expired':   return 'EXPIRED';
      case 'suspended': return 'SUSPENDED';
      default:          return 'TRIAL';
    }
  }

  private mapPaymentStatus(invoiceStatus: string): string {
    switch (invoiceStatus) {
      case 'paid':     return 'PAID';
      case 'failed':   return 'FAILED';
      case 'refunded': return 'REFUNDED';
      default:         return 'PENDING';
    }
  }
}
