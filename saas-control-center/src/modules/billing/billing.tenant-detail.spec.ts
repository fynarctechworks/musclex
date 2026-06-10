import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BILLING_GATEWAY } from './gateway/billing-gateway.interface';

/**
 * Unit tests for BillingService.getTenantBillingDetail — the data behind the
 * SCC /billing per-tenant drawer. It stitches scc (tenant/subscription/payments)
 * with main-app reads (public.studios billing profile + public.invoices) and
 * derives a summary + a "pending & missing" issues list.
 *
 * The cross-schema reads go through $queryRawUnsafe; the stub routes by SQL
 * substring (studios vs invoices). The unrelated constructor deps (audit,
 * idempotency, gateway) are stubbed empty — getTenantBillingDetail never uses
 * them.
 */
type Fixture = {
  tenant: any;
  studio?: any | null;
  invoices?: any[];
  payments?: any[];
};

async function buildService(fx: Fixture) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue(fx.tenant) },
    payment: { findMany: jest.fn().mockResolvedValue(fx.payments ?? []) },
    $queryRawUnsafe: jest.fn(async (sql: string) => {
      if (sql.includes('public.studios')) return fx.studio ? [fx.studio] : [];
      if (sql.includes('public.invoices')) return fx.invoices ?? [];
      return [];
    }),
  };

  const mod = await Test.createTestingModule({
    providers: [
      BillingService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditLogsService, useValue: { log: jest.fn() } },
      { provide: IdempotencyService, useValue: {} },
      { provide: BILLING_GATEWAY, useValue: {} },
    ],
  }).compile();

  return { svc: mod.get(BillingService), prisma };
}

const baseTenant = {
  id: 't-1',
  name: 'Shiva Gym',
  slug: 'shiva-gym',
  status: 'ACTIVE',
  owner_email: 'owner@shiva.test',
  owner_name: 'Owner',
  phone: null,
  plan: { id: 'p-ent', name: 'enterprise', price_monthly: 4999, price_yearly: 49990 },
  subscriptions: [
    { id: 's-1', status: 'ACTIVE', start_date: new Date(), end_date: new Date(), auto_renew: true, canceled_at: null },
  ],
};

const DAY = 24 * 60 * 60 * 1000;

describe('BillingService.getTenantBillingDetail', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws NotFound when the tenant does not exist', async () => {
    const { svc } = await buildService({ tenant: null });
    await expect(svc.getTenantBillingDetail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('assembles a healthy linked tenant: summary totals + only the tax-id gap', async () => {
    const { svc } = await buildService({
      tenant: baseTenant,
      studio: {
        id: 's-1',
        billing_name: 'Phanendra',
        billing_email: 'billing@shiva.test',
        billing_address: '123 Street',
        tax_id: '', // empty string counts as missing…
        gstin: null, // …and no GSTIN either → the one expected issue
        business_name: 'Shiva Pvt Ltd',
        currency: 'INR',
        billing_cycle: 'monthly',
        subscription_plan: 'enterprise',
        subscription_status: 'active',
        lifecycle_status: 'active',
        subscription_start: new Date(),
        subscription_expires_at: new Date(Date.now() + 30 * DAY),
        next_billing_date: new Date(Date.now() + 30 * DAY), // future → not overdue
        trial_ends_at: null,
        grace_until: null,
        locked_at: null,
        suspended_at: null,
      },
      invoices: [
        { id: 'i-1', invoice_number: 'INV-1', amount: 4999, currency: 'INR', status: 'paid', billing_period_start: new Date(), billing_period_end: new Date(), paid_at: new Date(), invoice_url: null, created_at: new Date() },
        { id: 'i-2', invoice_number: 'INV-2', amount: 4999, currency: 'INR', status: 'paid', billing_period_start: new Date(), billing_period_end: new Date(), paid_at: new Date(), invoice_url: null, created_at: new Date() },
      ],
      payments: [
        { id: 'pay-1', tenant_id: 't-1', amount: 4999, currency: 'INR', status: 'PAID', gateway: 'internal', created_at: new Date() },
        { id: 'pay-2', tenant_id: 't-1', amount: 4999, currency: 'INR', status: 'PAID', gateway: 'internal', created_at: new Date() },
      ],
    });

    const r = await svc.getTenantBillingDetail('t-1');

    expect(r.summary).toMatchObject({
      total_paid: 9998,
      paid_count: 2,
      pending_count: 0,
      failed_count: 0,
      invoice_count: 2,
      currency: 'INR',
    });
    expect(r.billing_info?.billing_name).toBe('Phanendra');
    expect(r.lifecycle?.status).toBe('active');
    expect(r.invoices).toHaveLength(2);
    expect(r.payments).toHaveLength(2);
    // Healthy profile + active sub + future billing → the only gap is the tax id.
    expect(r.issues.map((i) => i.code)).toEqual(['no_tax_id']);
  });

  it('flags a manual tenant with no linked studio', async () => {
    const { svc } = await buildService({
      tenant: { ...baseTenant, slug: 'manual-co' },
      studio: null,
      payments: [{ id: 'pay-x', tenant_id: 't-1', amount: 999, currency: 'INR', status: 'PAID', gateway: 'manual', created_at: new Date() }],
    });

    const r = await svc.getTenantBillingDetail('t-1');
    expect(r.billing_info).toBeNull();
    expect(r.lifecycle).toBeNull();
    expect(r.summary.total_paid).toBe(999);
    expect(r.issues.map((i) => i.code)).toEqual(['not_linked']);
  });

  it('surfaces locked + past-due + incomplete profile + failed/pending payments', async () => {
    const { svc } = await buildService({
      tenant: baseTenant,
      studio: {
        id: 's-1',
        billing_name: null,
        billing_email: null,
        billing_address: null,
        tax_id: null,
        gstin: null,
        business_name: null,
        currency: 'INR',
        billing_cycle: 'monthly',
        subscription_plan: 'pro',
        subscription_status: 'past_due',
        lifecycle_status: 'locked',
        subscription_start: new Date(Date.now() - 60 * DAY),
        subscription_expires_at: new Date(Date.now() - 5 * DAY),
        next_billing_date: new Date(Date.now() - 5 * DAY), // past, but locked already covers it
        trial_ends_at: null,
        grace_until: new Date(Date.now() - 2 * DAY),
        locked_at: new Date(Date.now() - 2 * DAY),
        suspended_at: null,
      },
      invoices: [],
      payments: [
        { id: 'pay-f', tenant_id: 't-1', amount: 4999, currency: 'INR', status: 'FAILED', gateway: 'internal', created_at: new Date() },
        { id: 'pay-p', tenant_id: 't-1', amount: 4999, currency: 'INR', status: 'PENDING', gateway: 'internal', created_at: new Date() },
      ],
    });

    const r = await svc.getTenantBillingDetail('t-1');

    expect(r.summary).toMatchObject({ total_paid: 0, failed_count: 1, pending_count: 1, invoice_count: 0 });

    const codes = r.issues.map((i) => i.code);
    // locked already accounts for the passed billing date → no separate billing_overdue.
    expect(codes).toEqual([
      'locked',
      'past_due',
      'profile_incomplete',
      'no_tax_id',
      'no_invoices',
      'failed_payments',
      'pending_payments',
    ]);
    expect(codes).not.toContain('billing_overdue');

    // Severities are wired correctly for the headline problems.
    const byCode = Object.fromEntries(r.issues.map((i) => [i.code, i.severity]));
    expect(byCode.locked).toBe('error');
    expect(byCode.failed_payments).toBe('error');
    expect(byCode.pending_payments).toBe('warning');
    expect(byCode.profile_incomplete).toBe('warning');
  });

  it('reports billing_overdue when the next billing date passed but the sub is still active', async () => {
    const { svc } = await buildService({
      tenant: baseTenant,
      studio: {
        id: 's-1',
        billing_name: 'X', billing_email: 'x@y.z', billing_address: 'addr',
        tax_id: 'TAX123', gstin: null, business_name: 'X', currency: 'INR', billing_cycle: 'monthly',
        subscription_plan: 'pro', subscription_status: 'active', lifecycle_status: 'active',
        subscription_start: new Date(Date.now() - 60 * DAY),
        subscription_expires_at: new Date(Date.now() - 1 * DAY),
        next_billing_date: new Date(Date.now() - 1 * DAY), // passed
        trial_ends_at: null, grace_until: null, locked_at: null, suspended_at: null,
      },
      invoices: [{ id: 'i-1', invoice_number: 'INV-1', amount: 4999, currency: 'INR', status: 'paid', billing_period_start: null, billing_period_end: null, paid_at: new Date(), invoice_url: null, created_at: new Date() }],
      payments: [{ id: 'pay-1', tenant_id: 't-1', amount: 4999, currency: 'INR', status: 'PAID', gateway: 'internal', created_at: new Date() }],
    });

    const r = await svc.getTenantBillingDetail('t-1');
    expect(r.issues.map((i) => i.code)).toEqual(['billing_overdue']);
  });
});
