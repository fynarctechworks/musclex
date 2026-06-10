/**
 * Demo operational-data seeder for the SaaS Control Center.
 *
 * Populates tenants, subscriptions, payments, and a few plan feature-flag
 * overrides so every admin page (Dashboard, Analytics, Subscriptions, Billing,
 * Feature Flags) shows realistic data instead of empty tables.
 *
 * SAFE TO RE-RUN: every write is keyed by a stable `demo-*` slug and is
 * upserted, so running this repeatedly does not duplicate data.
 *
 * It also backfills any EXISTING real tenant that has no plan/subscription
 * (e.g. one created before subscriptions were auto-created on tenant-create).
 *
 * Run:    npx ts-node scripts/seed-demo-data.ts
 * Remove: npx ts-node scripts/seed-demo-data.ts --clean   (deletes demo-* only)
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, SubscriptionStatus, PaymentStatus, TenantStatus } from '@prisma/client';

// Load DATABASE_URL from .env (this script may run outside the Nest/Prisma CLI
// context that auto-loads it).
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env');
  const m = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m);
  if (m) process.env.DATABASE_URL = m[1];
}

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * DAY);
}

interface DemoSpec {
  slug: string;
  name: string;
  owner_name: string;
  owner_email: string;
  phone: string;
  planName: 'free' | 'starter' | 'pro' | 'enterprise';
  tenantStatus: TenantStatus;
  subStatus: SubscriptionStatus;
  ageMonths: number;
  expiringSoon?: boolean;
}

const DEMO: DemoSpec[] = [
  { slug: 'demo-ironworks-gym',   name: 'Demo — Ironworks Gym',     owner_name: 'Rohan Mehta',   owner_email: 'rohan@ironworks.demo',   phone: '+91 90000 10001', planName: 'pro',        tenantStatus: 'ACTIVE',    subStatus: 'ACTIVE',   ageMonths: 6 },
  { slug: 'demo-pulse-fitness',   name: 'Demo — Pulse Fitness',     owner_name: 'Aisha Khan',    owner_email: 'aisha@pulse.demo',       phone: '+91 90000 10002', planName: 'starter',    tenantStatus: 'ACTIVE',    subStatus: 'ACTIVE',   ageMonths: 5 },
  { slug: 'demo-zenith-yoga',     name: 'Demo — Zenith Yoga',       owner_name: 'Maya Iyer',     owner_email: 'maya@zenith.demo',       phone: '+91 90000 10003', planName: 'starter',    tenantStatus: 'ACTIVE',    subStatus: 'ACTIVE',   ageMonths: 4, expiringSoon: true },
  { slug: 'demo-titan-crossfit',  name: 'Demo — Titan CrossFit',    owner_name: 'Vikram Rao',    owner_email: 'vikram@titan.demo',      phone: '+91 90000 10004', planName: 'enterprise', tenantStatus: 'ACTIVE',    subStatus: 'ACTIVE',   ageMonths: 4 },
  { slug: 'demo-apex-athletics',  name: 'Demo — Apex Athletics',    owner_name: 'Sara Dsouza',   owner_email: 'sara@apex.demo',         phone: '+91 90000 10005', planName: 'pro',        tenantStatus: 'ACTIVE',    subStatus: 'PAST_DUE', ageMonths: 3 },
  { slug: 'demo-flexspace',       name: 'Demo — FlexSpace Studio',  owner_name: 'Neil Verma',    owner_email: 'neil@flexspace.demo',    phone: '+91 90000 10006', planName: 'free',       tenantStatus: 'TRIAL',     subStatus: 'TRIALING', ageMonths: 1 },
  { slug: 'demo-coastline-club',  name: 'Demo — Coastline Club',    owner_name: 'Priya Nair',    owner_email: 'priya@coastline.demo',   phone: '+91 90000 10007', planName: 'starter',    tenantStatus: 'SUSPENDED', subStatus: 'CANCELED', ageMonths: 2 },
  { slug: 'demo-nova-wellness',   name: 'Demo — Nova Wellness',     owner_name: 'Arjun Pillai',  owner_email: 'arjun@nova.demo',        phone: '+91 90000 10008', planName: 'free',       tenantStatus: 'TRIAL',     subStatus: 'TRIALING', ageMonths: 0 },
];

async function clean() {
  const demoTenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: 'demo-' } },
    select: { id: true },
  });
  const ids = demoTenants.map((t) => t.id);
  if (ids.length) {
    // payments + subscriptions cascade on tenant delete, but be explicit
    await prisma.payment.deleteMany({ where: { tenant_id: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { tenant_id: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
  }
  console.log(`Removed ${ids.length} demo tenant(s) and their data.`);
}

async function subEndDate(spec: DemoSpec, trialEndsAt: Date): Promise<Date> {
  if (spec.subStatus === 'TRIALING') return trialEndsAt;
  if (spec.expiringSoon) return daysFromNow(5);
  if (spec.subStatus === 'CANCELED') return monthsAgo(spec.ageMonths - 1);
  return daysFromNow(30);
}

async function upsertSubscription(
  tenantId: string,
  planId: string,
  status: SubscriptionStatus,
  start: Date,
  end: Date,
) {
  const existing = await prisma.subscription.findFirst({ where: { tenant_id: tenantId } });
  const data = {
    plan_id: planId,
    status,
    start_date: start,
    end_date: end,
    auto_renew: status === 'ACTIVE',
    canceled_at: status === 'CANCELED' ? end : null,
  };
  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  const created = await prisma.subscription.create({ data: { tenant_id: tenantId, ...data } });
  return created.id;
}

async function seedPaymentsForTenant(
  tenantId: string,
  subscriptionId: string,
  price: number,
  spec: DemoSpec,
) {
  // Idempotent: clear this demo tenant's payments, then regenerate.
  await prisma.payment.deleteMany({ where: { tenant_id: tenantId } });
  if (price <= 0) return; // free plans don't pay

  const rows: any[] = [];
  for (let m = spec.ageMonths; m >= 0; m--) {
    const when = monthsAgo(m);
    const isLatest = m === 0;
    // Apex (PAST_DUE) fails its most recent charge; everyone else pays.
    const failed = isLatest && spec.subStatus === 'PAST_DUE';
    rows.push({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      amount: price,
      currency: 'INR',
      status: failed ? PaymentStatus.FAILED : PaymentStatus.PAID,
      gateway: 'razorpay',
      gateway_payment_id: `demo_pay_${tenantId.slice(0, 8)}_${m}`,
      failure_reason: failed ? 'Card declined (insufficient funds)' : null,
      created_at: when,
    });
  }
  if (rows.length) await prisma.payment.createMany({ data: rows });
}

async function backfillRealTenants(starterPlanId: string, starterLimits: Record<string, number>) {
  // Give any existing real (non-demo) tenant that has no plan a Starter plan +
  // an ACTIVE subscription so it stops being invisible to billing/analytics.
  const planless = await prisma.tenant.findMany({
    where: { plan_id: null, slug: { not: { startsWith: 'demo-' } } },
  });
  for (const t of planless) {
    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        plan_id: starterPlanId,
        max_members: starterLimits.max_members ?? t.max_members,
        max_branches: starterLimits.max_branches ?? t.max_branches,
        max_staff: starterLimits.max_staff ?? t.max_staff,
      },
    });
    const start = monthsAgo(1);
    await upsertSubscription(t.id, starterPlanId, 'ACTIVE', start, daysFromNow(30));
    console.log(`Backfilled real tenant "${t.name}" → starter + ACTIVE subscription.`);
  }
}

async function main() {
  if (process.argv.includes('--clean')) {
    await clean();
    return;
  }

  const plans = await prisma.subscriptionPlan.findMany();
  const planByName = new Map(plans.map((p) => [p.name, p]));
  const starter = planByName.get('starter');
  if (!starter) throw new Error('Plans not seeded — run `npm run prisma:seed` first.');

  await backfillRealTenants(starter.id, (starter.limits as Record<string, number>) ?? {});

  for (const spec of DEMO) {
    const plan = planByName.get(spec.planName)!;
    const limits = (plan.limits as Record<string, number>) ?? {};
    const createdAt = monthsAgo(spec.ageMonths);
    const trialEndsAt = new Date(createdAt.getTime() + 14 * DAY);

    const tenant = await prisma.tenant.upsert({
      where: { slug: spec.slug },
      update: {
        name: spec.name,
        owner_name: spec.owner_name,
        owner_email: spec.owner_email,
        phone: spec.phone,
        account_type: 'gym',
        status: spec.tenantStatus,
        is_active: spec.tenantStatus !== 'SUSPENDED',
        plan_id: plan.id,
        max_members: limits.max_members ?? 50,
        max_branches: limits.max_branches ?? 1,
        max_staff: limits.max_staff ?? 5,
        trial_ends_at: spec.subStatus === 'TRIALING' ? trialEndsAt : null,
      },
      create: {
        slug: spec.slug,
        name: spec.name,
        owner_name: spec.owner_name,
        owner_email: spec.owner_email,
        phone: spec.phone,
        account_type: 'gym',
        status: spec.tenantStatus,
        is_active: spec.tenantStatus !== 'SUSPENDED',
        plan_id: plan.id,
        max_members: limits.max_members ?? 50,
        max_branches: limits.max_branches ?? 1,
        max_staff: limits.max_staff ?? 5,
        trial_ends_at: spec.subStatus === 'TRIALING' ? trialEndsAt : null,
        created_at: createdAt,
      },
    });

    const end = await subEndDate(spec, trialEndsAt);
    const subId = await upsertSubscription(tenant.id, plan.id, spec.subStatus, createdAt, end);
    await seedPaymentsForTenant(tenant.id, subId, Number(plan.price_monthly), spec);
    console.log(`Seeded ${spec.slug} (${spec.planName}, ${spec.subStatus}).`);
  }

  // A couple of plan-level feature-flag overrides so the Feature Flags grid
  // shows real overrides instead of all-defaults.
  const flags = await prisma.featureFlag.findMany();
  const flagByKey = new Map(flags.map((f) => [f.key, f]));
  const pro = planByName.get('pro');
  const enterprise = planByName.get('enterprise');
  for (const [plan, key, enabled] of [
    [pro, 'ai_advisor', true],
    [enterprise, 'ai_advisor', true],
    [enterprise, 'api_access', true],
  ] as const) {
    const flag = flagByKey.get(key);
    if (plan && flag) {
      await prisma.planFeatureFlag.upsert({
        where: { plan_id_flag_id: { plan_id: plan.id, flag_id: flag.id } },
        update: { enabled },
        create: { plan_id: plan.id, flag_id: flag.id, enabled },
      });
    }
  }

  const counts = {
    tenants: await prisma.tenant.count(),
    subscriptions: await prisma.subscription.count(),
    payments: await prisma.payment.count(),
    plan_feature_flags: await prisma.planFeatureFlag.count(),
  };
  console.log('Done. Current counts:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
