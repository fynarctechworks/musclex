/**
 * ============================================================================
 * SECOND TEST GYM — so multi-workspace can actually be exercised
 * ============================================================================
 *
 * `/auth/select-workspace` and the workspace picker only appear for a user who
 * holds roles in MORE THAN ONE studio. The main seeder creates one gym, so
 * that whole path had never been run.
 *
 * This provisions a second studio and grants the EXISTING owner account a role
 * in it, making `owner@mxtest.app` a two-workspace user.
 *
 * SAFETY:
 *  - Writes only under GYM2_ID, a fixed test UUID.
 *  - Refuses to touch a schema whose name is not this gym's own.
 *  - Idempotent: re-running updates rather than duplicating.
 *
 * Run: npx ts-node scripts/seed-second-gym.ts
 * ============================================================================
 */
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

for (const candidate of [join(process.cwd(), '.env'), join(__dirname, '..', '.env')]) {
  if (existsSync(candidate)) {
    for (const line of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    break;
  }
}

const GYM1_ID = 'a5711f00-0000-4000-8000-000000000001';
const GYM2_ID = 'b6822a00-0000-4000-8000-000000000001';
const BRANCH2_ID = 'b6822a00-0000-4000-8000-000000000002';
const SCHEMA2 = `studio_${GYM2_ID.replace(/-/g, '_')}`;
const OWNER_EMAIL = 'owner@mxtest.app';

const FIRST = ['Kavya', 'Rohit', 'Ishaan', 'Tara', 'Nikhil', 'Aditi'];
const LAST = ['Joshi', 'Chopra', 'Verma', 'Rao', 'Pillai', 'Sethi'];
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const rand = (n: number) => Math.floor(Math.random() * n) + 1;

async function main() {
  const url = process.env.DATABASE_URL?.replace(/\?.*/, '');
  if (!url) throw new Error('DATABASE_URL is not set');

  const db = new Client({ connectionString: url });
  await db.connect();

  try {
    if (SCHEMA2 !== `studio_${GYM2_ID.replace(/-/g, '_')}`) {
      throw new Error('Refusing: schema name does not belong to the second test gym');
    }

    // ── Studio row ──
    const owner = await db.query(
      `SELECT id FROM public.user_identities WHERE email=$1`, [OWNER_EMAIL],
    );
    const ownerUserId = owner.rows[0]?.id;
    if (!ownerUserId) {
      throw new Error(`${OWNER_EMAIL} not found — run seed-staff-app-test first`);
    }

    await db.query(
      `INSERT INTO public.studios (id, name, slug, schema_name, owner_user_id, referral_code, subscription_plan, currency, timezone)
       VALUES ($1,'MuscleX Bandra','musclex-bandra',$2,$3,'TESTGYM02','pro','INR','Asia/Kolkata')
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, schema_name=EXCLUDED.schema_name,
         owner_user_id=EXCLUDED.owner_user_id`,
      [GYM2_ID, SCHEMA2, ownerUserId],
    );

    // ── Tenant schema, cloned from the template exactly as the product does ──
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA2}"`);
    const tables = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname='studio_template'`,
    );
    for (const { tablename } of tables.rows) {
      await db.query(
        `CREATE TABLE IF NOT EXISTS "${SCHEMA2}"."${tablename}" (LIKE studio_template."${tablename}" INCLUDING ALL)`,
      );
    }

    // Idempotent reset — guarded, same rule the main seeder uses.
    if (SCHEMA2 !== `studio_${GYM2_ID.replace(/-/g, '_')}`) {
      throw new Error(`Refusing to truncate ${SCHEMA2}`);
    }
    await db.query(
      `TRUNCATE ${SCHEMA2}.members, ${SCHEMA2}.membership_plans, ${SCHEMA2}.branches CASCADE`,
    );

    await db.query(
      `INSERT INTO ${SCHEMA2}.branches (id, gym_id, name, is_active)
       VALUES ($1,$2,'Bandra Branch',true) ON CONFLICT (id) DO NOTHING`,
      [BRANCH2_ID, GYM2_ID],
    );

    const planId = randomUUID();
    await db.query(
      `INSERT INTO ${SCHEMA2}.membership_plans (id, gym_id, branch_id, name, plan_type, duration_days, price, currency, is_active)
       VALUES ($1,$2,$3,'Bandra Monthly','duration',30,3200,'INR',true)`,
      [planId, GYM2_ID, BRANCH2_ID],
    );

    /*
     * Deliberately a DIFFERENT member count from gym 1 (which has 40).
     * If both gyms looked alike, a workspace switch that silently kept showing
     * the previous gym's data would be invisible — which is exactly the bug
     * this fixture exists to catch.
     */
    for (let i = 0; i < 12; i++) {
      await db.query(
        `INSERT INTO ${SCHEMA2}.members (id, gym_id, branch_id, member_code, full_name, phone, gender, status, join_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',now())`,
        [randomUUID(), GYM2_ID, BRANCH2_ID, `BND${String(2000 + i)}`,
         `${pick(FIRST)} ${pick(LAST)}`, `98${String(770000000 + rand(999999))}`,
         pick(['male', 'female'])],
      );
    }

    // ── The point of all this: the owner now holds roles in TWO studios ──
    await db.query(
      `INSERT INTO public.user_roles (id, user_id, studio_id, role_name, is_primary)
       VALUES ($1,$2,$3,'owner',false)
       ON CONFLICT DO NOTHING`,
      [randomUUID(), ownerUserId, GYM2_ID],
    );

    const workspaces = await db.query(
      `SELECT s.name, ur.role_name FROM public.user_roles ur
         JOIN public.studios s ON s.id = ur.studio_id
        WHERE ur.user_id = $1 ORDER BY s.name`, [ownerUserId],
    );

    console.log(`\n  Second gym ready: MuscleX Bandra (12 members, 1 plan)`);
    console.log(`  ${OWNER_EMAIL} now has ${workspaces.rows.length} workspaces:`);
    for (const w of workspaces.rows) console.log(`    - ${w.name} (${w.role_name})`);
    console.log(`\n  Gym 1 has 40 members, gym 2 has 12 — a switch that does not`);
    console.log(`  take effect is visible immediately.\n`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
