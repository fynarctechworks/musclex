/**
 * Import/refresh SCC tenants from the main app's public.studios table.
 *
 * The real gyms live in public.studios (owned by the main MuscleX app). The SCC
 * owns scc.tenants. This projects studios → scc.tenants (upsert by slug) plus a
 * matching subscription, so the control center reflects the real customer base.
 *
 * This mirrors TenantService.syncFromStudios() (the product path is
 * POST /tenants/sync + the "Sync from app" button); this script is the CLI/cron
 * equivalent for running it without the server.
 *
 * Run: npx ts-node scripts/sync-studios.ts   (or: npm run sync:studios)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  PrismaClient,
  TenantStatus,
  SubscriptionStatus,
} from '@prisma/client';

if (!process.env.DATABASE_URL) {
  const m = fs
    .readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .match(/^DATABASE_URL="?([^"\n]+)"?/m);
  if (m) process.env.DATABASE_URL = m[1];
}

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

interface StudioRow {
  id: string; name: string; slug: string; email: string | null; phone: string | null;
  billing_name: string | null; business_name: string | null; account_type: string | null;
  subscription_plan: string | null; subscription_status: string | null; lifecycle_status: string | null;
  suspended_at: Date | null; trial_ends_at: Date | null; subscription_start: Date | null;
  subscription_expires_at: Date | null; next_billing_date: Date | null; schema_name: string | null;
  created_at: Date;
}

function mapStudioStatus(s: StudioRow): TenantStatus {
  if (s.suspended_at || s.lifecycle_status === 'suspended') return TenantStatus.SUSPENDED;
  const ss = (s.subscription_status ?? '').toLowerCase();
  if (ss === 'trial' || ss === 'trialing') return TenantStatus.TRIAL;
  if (ss === 'expired' || s.lifecycle_status === 'expired') return TenantStatus.EXPIRED;
  return TenantStatus.ACTIVE;
}

function mapSubStatus(s: StudioRow): SubscriptionStatus {
  const ss = (s.subscription_status ?? '').toLowerCase();
  if (ss === 'trial' || ss === 'trialing') return SubscriptionStatus.TRIALING;
  if (ss === 'past_due') return SubscriptionStatus.PAST_DUE;
  if (ss === 'canceled' || ss === 'cancelled') return SubscriptionStatus.CANCELED;
  if (ss === 'expired') return SubscriptionStatus.EXPIRED;
  return SubscriptionStatus.ACTIVE;
}

async function main() {
  const studios = await prisma.$queryRawUnsafe<StudioRow[]>(`
    SELECT id, name, slug, email, phone, billing_name, business_name, account_type,
           subscription_plan, subscription_status, lifecycle_status, suspended_at,
           trial_ends_at, subscription_start, subscription_expires_at, next_billing_date,
           schema_name, created_at
    FROM public.studios
  `);

  const plans = await prisma.subscriptionPlan.findMany();
  const planByName = new Map(plans.map((p) => [p.name.toLowerCase(), p]));

  let imported = 0;
  let updated = 0;

  for (const s of studios) {
    const plan = s.subscription_plan ? planByName.get(s.subscription_plan.toLowerCase()) : undefined;
    const limits = (plan?.limits as Record<string, number> | undefined) ?? {};
    const status = mapStudioStatus(s);
    const ownerName = s.billing_name || s.business_name || (s.email ? s.email.split('@')[0] : 'Owner');

    const base: any = {
      name: s.name,
      owner_email: s.email ?? `${s.slug}@unknown.local`,
      owner_name: ownerName,
      phone: s.phone ?? undefined,
      account_type: s.account_type ?? 'gym',
      status,
      is_active: status !== TenantStatus.SUSPENDED,
      plan_id: plan?.id ?? null,
      trial_ends_at: s.trial_ends_at ?? null,
      metadata: { studio_id: s.id, schema_name: s.schema_name, source: 'studios' },
    };
    if (plan) {
      if (limits.max_members != null) base.max_members = limits.max_members;
      if (limits.max_branches != null) base.max_branches = limits.max_branches;
      if (limits.max_staff != null) base.max_staff = limits.max_staff;
    }

    const existing = await prisma.tenant.findUnique({ where: { slug: s.slug } });
    const tenant = existing
      ? (updated++, await prisma.tenant.update({ where: { id: existing.id }, data: base }))
      : (imported++, await prisma.tenant.create({ data: { slug: s.slug, created_at: s.created_at, ...base } }));

    if (plan) {
      const start = s.subscription_start ?? s.created_at;
      const end =
        s.subscription_expires_at ?? s.next_billing_date ?? s.trial_ends_at ?? new Date(start.getTime() + 30 * DAY);
      const subData = {
        plan_id: plan.id,
        status: mapSubStatus(s),
        start_date: start,
        end_date: end,
        auto_renew: mapSubStatus(s) === SubscriptionStatus.ACTIVE,
      };
      const sub = await prisma.subscription.findFirst({ where: { tenant_id: tenant.id } });
      if (sub) await prisma.subscription.update({ where: { id: sub.id }, data: subData });
      else await prisma.subscription.create({ data: { tenant_id: tenant.id, ...subData } });
    }
    console.log(`${existing ? 'updated' : 'imported'}: ${s.name} (${s.slug}) → ${status}/${plan?.name ?? 'no-plan'}`);
  }

  console.log(`\nDone. imported=${imported} updated=${updated} total=${studios.length}`);
  console.log('Counts:', {
    tenants: await prisma.tenant.count(),
    subscriptions: await prisma.subscription.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
