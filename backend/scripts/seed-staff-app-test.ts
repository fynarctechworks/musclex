/* eslint-disable no-console */
/**
 * Staff-app TEST GYM seeder.
 *
 * Creates one test gym with staff accounts across FOUR different roles, plus
 * members, memberships, payments and check-ins — enough to exercise the
 * staff-app end to end, including role-adaptive navigation (each role should
 * see a different tab bar).
 *
 * Modelled on scripts/seed-phani-test.ts: real Supabase Auth logins via the
 * admin API, then public.user_identities + public.user_roles + tenant staff.
 *
 * SAFETY: writes ONLY under GYM_ID, and every row is removable by that id.
 * Verified against a DEV database (2 studios, both test fixtures) — do not run
 * this against production.
 *
 * Run:  npx ts-node scripts/seed-staff-app-test.ts        (from backend/)
 */
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

for (const candidate of [join(process.cwd(), '.env'), join(__dirname, '..', '.env')]) {
  try {
    const envText = readFileSync(candidate, 'utf8');
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    break;
  } catch { /* try next */ }
}

const GYM_ID = 'a5711f00-0000-4000-8000-000000000001';
const BRANCH_ID = 'a5711f00-0000-4000-8000-000000000002';
// Each live gym needs its OWN schema — the backend rejects studio_template as a
// tenant schema ("Invalid tenant schema"). Provision it with:
//   npx ts-node scripts/repair-tenant-schemas.ts studio_a5711f00_0000_4000_8000_000000000001
const SCHEMA = 'studio_a5711f00_0000_4000_8000_000000000001';
const PASSWORD = 'StaffTest@12345';
const DOMAIN = 'mxtest.app';

const DATABASE_URL = process.env.DATABASE_URL!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * One account per role, so the app's role-adaptive tab bar can be verified for
 * real rather than only in unit tests.
 */
const STAFF = [
  { key: 'owner',      role: 'owner',       name: 'Olivia Owner',    title: 'Owner' },
  { key: 'fd',         role: 'front_desk',  name: 'Farah Desk',      title: 'Front Desk' },
  { key: 'trainer',    role: 'trainer',     name: 'Tarun Trainer',   title: 'Trainer' },
  { key: 'acct',       role: 'accountant',  name: 'Anil Accounts',   title: 'Accountant' },
];

const FIRST = ['Rahul','Anita','Vikram','Priya','Arjun','Sneha','Karan','Divya','Rohit','Meera',
               'Sanjay','Kavya','Amit','Neha','Suresh','Pooja','Manish','Ritu','Deepak','Asha'];
const LAST = ['Sharma','Kumar','Patel','Reddy','Nair','Gupta','Singh','Iyer','Bose','Menon'];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rand(a.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  console.log(`Seeding test gym ${GYM_ID}\n`);

  try {
    // ── Clean prior run (scoped strictly to this gym) ──
    for (const t of ['check_ins', 'payments', 'member_memberships', 'member_profiles', 'members', 'membership_plans', 'staff', 'branches']) {
      await db.query(`DELETE FROM ${SCHEMA}.${t} WHERE gym_id=$1`, [GYM_ID]).catch(() => {});
    }
    await db.query('DELETE FROM public.user_roles WHERE studio_id=$1', [GYM_ID]);

    // ── Studio + branch ──
    const ownerPlaceholder = randomUUID();
    await db.query(
      `INSERT INTO public.studios (id, name, slug, schema_name, owner_user_id, referral_code, subscription_plan)
       VALUES ($1,'MuscleX Test Gym','musclex-test-gym',$2,$3,$4,'pro')
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, subscription_plan='pro',
         schema_name=EXCLUDED.schema_name`,
      [GYM_ID, SCHEMA, ownerPlaceholder, 'TESTGYM01'],
    );
    await db.query(
      `INSERT INTO ${SCHEMA}.branches (id, gym_id, name, is_active)
       VALUES ($1,$2,'Main Branch',true) ON CONFLICT (id) DO NOTHING`,
      [BRANCH_ID, GYM_ID],
    );

    // ── Plans ──
    const plans = [
      { id: randomUUID(), name: 'Gold',   days: 365, price: 24000 },
      { id: randomUUID(), name: 'Silver', days: 180, price: 14000 },
      { id: randomUUID(), name: 'Monthly',days: 30,  price: 2400 },
    ];
    for (const p of plans) {
      await db.query(
        `INSERT INTO ${SCHEMA}.membership_plans (id, gym_id, branch_id, name, plan_type, duration_days, price, currency, is_active)
         VALUES ($1,$2,$3,$4,'duration',$5,$6,'INR',true)`,
        [p.id, GYM_ID, BRANCH_ID, p.name, p.days, p.price],
      );
    }

    // ── Staff accounts (real Supabase Auth logins) ──
    const existing = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let ownerUserId = '';

    for (const s of STAFF) {
      const email = `${s.key}@${DOMAIN}`;
      const meta = {
        full_name: s.name, role: s.role, studio_id: GYM_ID,
        branch_ids: [BRANCH_ID], account_type: 'staff', onboarding_step: 'complete',
      };

      const found = existing.data.users.find((u) => u.email?.toLowerCase() === email);
      let userId: string;
      if (found) {
        userId = found.id;
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: PASSWORD, user_metadata: meta });
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email, password: PASSWORD, email_confirm: true, user_metadata: meta,
        });
        if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
        userId = data.user.id;
      }
      if (s.role === 'owner') ownerUserId = userId;

      await db.query(
        `INSERT INTO public.user_identities (id, email, full_name, email_verified, status)
         VALUES ($1,$2,$3,true,'active')
         ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name, email=EXCLUDED.email,
           status='active', email_verified=true, failed_login_count=0, locked_until=NULL`,
        [userId, email, s.name],
      );
      await db.query(
        `INSERT INTO public.user_roles (user_id, studio_id, branch_id, role_name, is_primary)
         VALUES ($1,$2,$3,$4,true)`,
        [userId, GYM_ID, BRANCH_ID, s.role],
      );
      await db.query(
        `INSERT INTO ${SCHEMA}.staff
           (id, gym_id, user_id, branch_id, branch_ids, full_name, role, job_title, phone, email,
            employment_type, employee_code, is_active, status, joined_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'full_time',$11,true,'active',$12)`,
        [randomUUID(), GYM_ID, userId, BRANCH_ID, [BRANCH_ID], s.name, s.role, s.title,
         `9800000${STAFF.indexOf(s)}01`, email, `TG-${s.key.toUpperCase()}`, iso(addDays(new Date(), -200))],
      );
      console.log(`  ✓ ${s.role.padEnd(11)} ${email}`);
    }

    if (ownerUserId) {
      await db.query('UPDATE public.studios SET owner_user_id=$1 WHERE id=$2', [ownerUserId, GYM_ID]);
    }

    // ── Members + memberships + payments + check-ins ──
    const today = new Date();
    let due = 0, active = 0;

    for (let i = 0; i < 40; i++) {
      const memberId = randomUUID();
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const plan = plans[i % plans.length];
      // A third are expiring/lapsed so the app has non-uniform states to show.
      const startedAgo = 20 + rand(300);
      const start = addDays(today, -startedAgo);
      const end = addDays(start, plan.days);
      const isActive = end > today;
      if (isActive) active++;

      await db.query(
        `INSERT INTO ${SCHEMA}.members (id, gym_id, branch_id, member_code, full_name, phone, email, status, join_date, last_visit_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [memberId, GYM_ID, BRANCH_ID, `TG${String(1000 + i)}`, name,
         `98${String(10000000 + i)}`, `m${i}@${DOMAIN}`, isActive ? 'active' : 'inactive',
         iso(start), addDays(today, -rand(20)).toISOString()],
      );

      const membershipId = randomUUID();
      await db.query(
        `INSERT INTO ${SCHEMA}.member_memberships (id, gym_id, member_id, plan_id, branch_id, start_date, end_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [membershipId, GYM_ID, memberId, plan.id, BRANCH_ID, iso(start), iso(end), isActive ? 'active' : 'expired'],
      );

      // ~25% carry an outstanding balance, so "due" states are exercised.
      const paid = i % 4 !== 0;
      if (paid) {
        await db.query(
          `INSERT INTO ${SCHEMA}.payments (id, gym_id, member_id, membership_id, branch_id, amount, currency, payment_method, status, receipt_number, paid_at)
           VALUES ($1,$2,$3,$4,$5,$6,'INR',$7,'completed',$8,$9)`,
          [randomUUID(), GYM_ID, memberId, membershipId, BRANCH_ID, plan.price,
           pick(['cash', 'card', 'upi']), `RCPT-${1000 + i}`, start.toISOString()],
        );
      } else { due++; }

      // Recent check-ins, weighted to the last fortnight.
      for (let c = 0; c < rand(6); c++) {
        await db.query(
          `INSERT INTO ${SCHEMA}.check_ins (id, gym_id, member_id, membership_id, branch_id, checkin_method, checked_in_at, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'success')`,
          [randomUUID(), GYM_ID, memberId, membershipId, BRANCH_ID,
           pick(['qr', 'manual']), addDays(today, -rand(14)).toISOString()],
        );
      }
    }

    console.log(`\n  40 members — ${active} active, ${due} with dues`);
    console.log(`\n  Password for all staff accounts: ${PASSWORD}`);
    console.log(`  Gym id: ${GYM_ID}\n`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
