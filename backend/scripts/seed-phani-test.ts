/* eslint-disable no-console */
/**
 * Phani Gym TEST DATA seeder.
 *
 * Seeds ONLY Phani Gym (gym_id below) in the shared `studio_template` schema.
 * Everything written is tenant-scoped to GYM_ID and tagged so it can be removed
 * cleanly (see scripts/seed-phani-test-cleanup.sql).
 *
 * Creates:
 *   - 5 trainers with REAL Supabase Auth logins (shared password) + staff + RBAC
 *   - 100 members, each with member_profiles (full details), unique phones/codes
 *   - member_memberships across many different dates & plans
 *   - ~15 "repeat buyers" with consecutive monthly memberships (renew every month)
 *   - ~1 month of classes (+ class_sessions) assigned to the trainers
 *
 * Idempotent: re-running first removes prior seed rows (tagged) and recreates them.
 * Trainer auth users are reused by email (password reset on re-run).
 *
 * Run:  npx ts-node scripts/seed-phani-test.ts        (from backend/)
 */
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

// Minimal .env loader (backend uses @nestjs/config at runtime; this is a standalone script)
for (const candidate of [
  join(process.cwd(), '.env'),
  join(__dirname, '..', '.env'),
  join(__dirname, '..', '..', '.env'),
]) {
  try {
    const envText = readFileSync(candidate, 'utf8');
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    break;
  } catch { /* try next candidate */ }
}

// ── Tenant + connection ──────────────────────────────────────────────
const GYM_ID = '55243e01-170e-4346-a7cf-390658780dda'; // Phani Gym (studio_id)
const SCHEMA = 'studio_template';
const TAG = 'SEED:phani-test';
const TRAINER_PASSWORD = 'Trainer@12345';
const TRAINER_EMAIL_DOMAIN = 'phani-test.musclex.app';

const DATABASE_URL = process.env.DATABASE_URL!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Reference data (already exists in Phani Gym) ─────────────────────
const BRANCHES = {
  capitalPark: '3a4af179-83c2-4ea7-83ca-a964a49fe7f9',
  branch2: '14452879-4ff1-4ff4-86ab-c3de16e68591',
};
// Plans are branch-specific (plan.branch_id must match member.branch_id).
// Real plan rows from the DB, grouped by branch:
const PLANS_BY_BRANCH: Record<string, { id: string; name: string; days: number; monthly: boolean }[]> = {
  [BRANCHES.capitalPark]: [
    { id: 'b387f503-9952-41aa-aed5-07e6bf302836', name: 'Basic Monthly', days: 30, monthly: true },
    { id: 'a9f013f6-efa1-4ca4-aa5e-8a070cff67fb', name: 'Premium Quarterly', days: 90, monthly: false },
    { id: '4cde8d5d-f5fc-425d-a3c8-0edf9bbd326b', name: 'Personal Training', days: 30, monthly: false },
    { id: '5d9f177a-9fca-441f-9cf3-0ec05bfe14d3', name: 'Annual Plan', days: 365, monthly: false },
  ],
  [BRANCHES.branch2]: [
    { id: '723bb000-dd17-4bd6-bcc2-3effb852b56f', name: 'Monthly Basic', days: 30, monthly: true },
    { id: '8fa96e7b-70bd-4c23-9e38-ac92ffc28051', name: 'Quarterly Standard', days: 90, monthly: false },
    { id: '7954b631-54cc-41df-ad29-3f0e8e8928b6', name: 'Annual Premium', days: 365, monthly: false },
  ],
};
const monthlyPlanFor = (branch: string) => PLANS_BY_BRANCH[branch].find((p) => p.monthly)!;

// ── Faker-lite pools ─────────────────────────────────────────────────
const FIRST = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Krishna','Ishaan','Rohan','Kabir','Ananya','Diya','Saanvi','Aadhya','Myra','Anika','Navya','Kiara','Pari','Riya','Meera','Aarohi','Tara','Karthik','Manish','Sneha','Pooja','Rahul','Nikhil','Priya','Deepak','Lakshmi','Sandeep','Harish','Swathi','Naveen','Divya','Kiran','Vamsi'];
const LAST = ['Sharma','Verma','Reddy','Naidu','Patel','Rao','Gupta','Iyer','Nair','Menon','Das','Kumar','Singh','Chowdary','Bose','Pillai','Joshi','Mehta','Shetty','Gandi'];
const GOALS = ['weight_loss','muscle_gain','endurance','flexibility','general_fitness','strength'];
const ACTIVITY = ['sedentary','light','moderate','active','very_active'];
const EXPERIENCE = ['beginner','intermediate','advanced'];
const BLOOD = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
const GENDERS = ['male','female','other'];
const CHURN = ['low','low','low','medium','medium','high'];
const CLASS_CATALOG = [
  { name: 'Morning Yoga', category: 'yoga', hour: 7, dur: 60, cap: 20 },
  { name: 'Power Strength', category: 'strength', hour: 9, dur: 60, cap: 15 },
  { name: 'HIIT Burn', category: 'hiit', hour: 18, dur: 45, cap: 25 },
  { name: 'Evening Zumba', category: 'dance', hour: 19, dur: 60, cap: 30 },
  { name: 'CrossFit WOD', category: 'crossfit', hour: 20, dur: 60, cap: 18 },
  { name: 'Spin Cycle', category: 'cardio', hour: 17, dur: 45, cap: 22 },
  { name: 'Boxing Basics', category: 'martial_arts', hour: 8, dur: 60, cap: 16 },
];

const pick = <T>(arr: T[], i: number): T => arr[i % arr.length];
const rand = (n: number) => Math.floor(Math.random() * n);
const pad = (n: number, w = 4) => String(n).padStart(w, '0');
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log(`Connected. Seeding Phani Gym (${GYM_ID}) — tag "${TAG}"\n`);

  try {
    // ───────────────────────────────────────────────────────────────
    // 0) CLEANUP prior seed rows (idempotent re-run)
    // ───────────────────────────────────────────────────────────────
    console.log('Cleaning up any prior seed rows…');
    const prevTrainers = await db.query(
      `SELECT id, user_id FROM ${SCHEMA}.staff WHERE gym_id=$1 AND employee_code LIKE 'PHT-TR-%'`,
      [GYM_ID],
    );
    const prevTrainerIds = prevTrainers.rows.map((r) => r.id);
    if (prevTrainerIds.length) {
      await db.query(`DELETE FROM ${SCHEMA}.class_sessions WHERE gym_id=$1 AND trainer_id = ANY($2::uuid[])`, [GYM_ID, prevTrainerIds]);
      await db.query(`DELETE FROM ${SCHEMA}.classes WHERE gym_id=$1 AND trainer_id = ANY($2::uuid[])`, [GYM_ID, prevTrainerIds]);
    }
    const prevMembers = await db.query(
      `SELECT id FROM ${SCHEMA}.members WHERE gym_id=$1 AND member_code LIKE 'PHT-%'`,
      [GYM_ID],
    );
    const prevMemberIds = prevMembers.rows.map((r) => r.id);
    if (prevMemberIds.length) {
      await db.query(`DELETE FROM ${SCHEMA}.member_memberships WHERE gym_id=$1 AND member_id = ANY($2::uuid[])`, [GYM_ID, prevMemberIds]);
      await db.query(`DELETE FROM ${SCHEMA}.member_profiles WHERE gym_id=$1 AND member_id = ANY($2::uuid[])`, [GYM_ID, prevMemberIds]);
      await db.query(`DELETE FROM ${SCHEMA}.members WHERE gym_id=$1 AND member_code LIKE 'PHT-%'`, [GYM_ID]);
    }
    console.log(`  removed ${prevMemberIds.length} prior members, ${prevTrainerIds.length} prior trainers\n`);

    // ───────────────────────────────────────────────────────────────
    // 1) TRAINERS — Supabase auth login + staff + RBAC
    // ───────────────────────────────────────────────────────────────
    console.log('Creating 5 trainers with real logins…');
    const trainerNames = ['Coach Ramesh', 'Coach Sneha', 'Coach Arjun', 'Coach Priya', 'Coach Vikram'];
    const trainerStaffIds: string[] = [];
    for (let i = 0; i < trainerNames.length; i++) {
      const n = i + 1;
      const email = `trainer${n}@${TRAINER_EMAIL_DOMAIN}`;
      const fullName = trainerNames[i];
      const branch = i % 2 === 0 ? BRANCHES.capitalPark : BRANCHES.branch2;

      // (a) auth user — reuse if exists, else create
      let userId: string;
      const existing = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = existing.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        userId = found.id;
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: TRAINER_PASSWORD,
          user_metadata: { full_name: fullName, role: 'trainer', studio_id: GYM_ID, account_type: 'staff', onboarding_step: 'complete' },
        });
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: TRAINER_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: 'trainer', studio_id: GYM_ID, branch_ids: [branch], account_type: 'staff', onboarding_step: 'complete' },
        });
        if (error || !data.user) throw new Error(`auth createUser failed for ${email}: ${error?.message}`);
        userId = data.user.id;
      }

      // (b) public.user_identities (upsert) + public.user_roles
      await db.query(
        `INSERT INTO public.user_identities (id, email, full_name, email_verified, status)
         VALUES ($1,$2,$3,true,'active')
         ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name, email=EXCLUDED.email`,
        [userId, email, fullName],
      );
      await db.query(`DELETE FROM public.user_roles WHERE user_id=$1 AND studio_id=$2`, [userId, GYM_ID]);
      await db.query(
        `INSERT INTO public.user_roles (user_id, studio_id, branch_id, role_name, is_primary)
         VALUES ($1,$2,$3,'trainer',true)`,
        [userId, GYM_ID, branch],
      );

      // (c) tenant staff row
      const staffId = randomUUID();
      trainerStaffIds.push(staffId);
      await db.query(
        `INSERT INTO ${SCHEMA}.staff
          (id, gym_id, user_id, branch_id, branch_ids, full_name, role, job_title, phone, email,
           specializations, employment_type, employee_code, is_active, status, joined_at, performance_score)
         VALUES ($1,$2,$3,$4,$5,$6,'trainer','Trainer',$7,$8,$9,'full_time',$10,true,'active',$11,$12)`,
        [
          staffId, GYM_ID, userId, branch, [branch], fullName,
          `90000000${10 + n}`, email,
          pick([['Strength','HIIT'], ['Yoga','Pilates'], ['CrossFit','Boxing'], ['Zumba','Dance'], ['Cardio','Spin']], i),
          `PHT-TR-${n}`, isoDate(addMonths(new Date(), -6)), 70 + rand(30),
        ],
      );
      console.log(`  ✓ ${fullName}  <${email}>  (staff ${staffId})`);
    }
    console.log(`  Trainer password (all): ${TRAINER_PASSWORD}\n`);

    // ───────────────────────────────────────────────────────────────
    // 2) MEMBERS (100) + profiles + memberships
    // ───────────────────────────────────────────────────────────────
    console.log('Creating 100 members + profiles + memberships…');
    const today = new Date();
    const REPEAT_BUYERS = 15; // first 15 renew monthly
    let membershipCount = 0;

    for (let i = 1; i <= 100; i++) {
      const first = pick(FIRST, i * 7 + 3);
      const last = pick(LAST, i * 3 + 1);
      const fullName = `${first} ${last}`;
      const branch = i % 5 === 0 ? BRANCHES.branch2 : (i % 2 === 0 ? BRANCHES.branch2 : BRANCHES.capitalPark);
      const memberId = randomUUID();
      const memberCode = `PHT-${pad(i)}`;
      const phone = `91${pad(i, 8)}`; // 10-digit, unique, clearly test (9100000001..)
      const email = `phani.test${pad(i)}@seed.musclex.test`;
      const gender = pick(GENDERS, i);
      const churn = pick(CHURN, i);
      // Different join dates: spread across the past 12 months
      const joinDaysAgo = (i * 11) % 360 + 3;
      const joinDate = addDays(today, -joinDaysAgo);
      const dob = isoDate(new Date(1985 + (i % 20), i % 12, (i % 27) + 1));
      const status = i % 17 === 0 ? 'inactive' : 'active';

      await db.query(
        `INSERT INTO ${SCHEMA}.members
          (id, gym_id, branch_id, member_code, full_name, phone, email, gender, date_of_birth,
           emergency_contact_name, emergency_contact_phone, status, churn_risk, checkin_method,
           qr_code, referral_code, join_date, last_visit_at, engagement_score, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual',$14,$15,$16,$17,$18,$19)`,
        [
          memberId, GYM_ID, branch, memberCode, fullName, phone, email, gender, dob,
          `${pick(FIRST, i + 5)} ${last}`, `92${pad(i, 8)}`, status, churn,
          randomUUID(), `PHTR${pad(i)}`, isoDate(joinDate),
          status === 'active' ? addDays(today, -(i % 14)).toISOString() : null,
          status === 'active' ? 40 + rand(60) : rand(30),
          TAG,
        ],
      );

      // profile (full details)
      await db.query(
        `INSERT INTO ${SCHEMA}.member_profiles
          (id, gym_id, member_id, height, weight, body_fat_percentage, fitness_goal, goals,
           workout_preferences, activity_level, training_experience, blood_group,
           medical_conditions, emergency_contact, emergency_phone, height_unit, weight_unit,
           onboarding_completed_at)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'cm','kg',$15)`,
        [
          GYM_ID, memberId,
          150 + rand(40), 50 + rand(50), 12 + rand(25),
          pick(GOALS, i),
          [pick(GOALS, i), pick(GOALS, i + 2)],
          [pick(['cardio','weights','functional','yoga','hiit'], i), pick(['cardio','weights','functional','yoga','hiit'], i + 1)],
          pick(ACTIVITY, i), pick(EXPERIENCE, i), pick(BLOOD, i),
          i % 6 === 0 ? ['asthma'] : (i % 9 === 0 ? ['knee injury'] : []),
          `${pick(FIRST, i + 5)} ${last}`, `92${pad(i, 8)}`,
          joinDate.toISOString(),
        ],
      );

      // memberships
      if (i <= REPEAT_BUYERS) {
        // Repeat buyer: N consecutive MONTHLY memberships (renews every month)
        const plan = monthlyPlanFor(branch);
        const cycles = 3 + (i % 4); // 3..6 months of history
        let start = addMonths(today, -cycles);
        for (let c = 0; c < cycles; c++) {
          const end = addMonths(start, 1);
          const isCurrent = c === cycles - 1;
          await db.query(
            `INSERT INTO ${SCHEMA}.member_memberships
              (id, gym_id, member_id, plan_id, branch_id, start_date, end_date, status, auto_renew)
             VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8)`,
            [GYM_ID, memberId, plan.id, branch, isoDate(start), isoDate(end), isCurrent ? 'active' : 'expired', isCurrent],
          );
          membershipCount++;
          start = end;
        }
      } else {
        // Normal member: one membership on a varied plan, dated from join date
        const plans = PLANS_BY_BRANCH[branch];
        const plan = pick(plans, i);
        const start = joinDate;
        const end = addDays(start, plan.days);
        const status = end < today ? 'expired' : 'active';
        await db.query(
          `INSERT INTO ${SCHEMA}.member_memberships
            (id, gym_id, member_id, plan_id, branch_id, start_date, end_date, status, auto_renew)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8)`,
          [GYM_ID, memberId, plan.id, branch, isoDate(start), isoDate(end), status, i % 4 === 0],
        );
        membershipCount++;
      }
      if (i % 25 === 0) console.log(`  …${i} members`);
    }
    console.log(`  ✓ 100 members, ${membershipCount} memberships (first ${REPEAT_BUYERS} are monthly repeat-buyers)\n`);

    // ───────────────────────────────────────────────────────────────
    // 3) CLASSES for the next 30 days (+ sessions)
    // ───────────────────────────────────────────────────────────────
    console.log('Creating ~1 month of classes…');
    let classCount = 0;
    for (let d = 0; d < 30; d++) {
      const day = addDays(today, d);
      // 4 classes/day, rotating catalog/trainer/branch
      for (let s = 0; s < 4; s++) {
        const cat = CLASS_CATALOG[(d * 4 + s) % CLASS_CATALOG.length];
        const trainerIdx = (d + s) % trainerStaffIds.length;
        const trainerId = trainerStaffIds[trainerIdx];
        const branch = trainerIdx % 2 === 0 ? BRANCHES.capitalPark : BRANCHES.branch2;
        const starts = new Date(day);
        starts.setHours(cat.hour, 0, 0, 0);
        const ends = new Date(starts.getTime() + cat.dur * 60000);
        const classId = randomUUID();
        await db.query(
          `INSERT INTO ${SCHEMA}.classes
            (id, gym_id, branch_id, trainer_id, name, category, room, capacity, duration_minutes, starts_at, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled')`,
          [classId, GYM_ID, branch, trainerId, cat.name, cat.category, `Studio ${1 + (s % 3)}`, cat.cap, cat.dur, starts.toISOString()],
        );
        await db.query(
          `INSERT INTO ${SCHEMA}.class_sessions
            (id, gym_id, branch_id, trainer_id, name, category, start_time, end_time, capacity, enrolled_count, status)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled')`,
          [GYM_ID, branch, trainerId, cat.name, cat.category, starts.toISOString(), ends.toISOString(), cat.cap, rand(cat.cap)],
        );
        classCount++;
      }
    }
    console.log(`  ✓ ${classCount} classes + ${classCount} sessions over next 30 days\n`);

    console.log('── DONE ───────────────────────────────────────────────');
    console.log(`Trainer logins: trainer1..5@${TRAINER_EMAIL_DOMAIN}  /  ${TRAINER_PASSWORD}`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
