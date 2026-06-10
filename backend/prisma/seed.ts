import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { PLAN_CONFIGS } from '../src/common/plan-configs';
import { randomBytes, randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Supabase Admin client for creating auth users
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ── Deterministic UUIDs for seed data (consistent across re-runs) ────────────
function seedUUID(ns: string, idx: number): string {
  // Generate a deterministic UUID-like string from namespace + index
  const hex = Buffer.from(`${ns}:${idx}:musclex-seed`).toString('hex').padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// ── Sample Gym Data ──────────────────────────────────────────────────────────
interface GymSeed {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  plan: string;
  status: string;
  timezone: string;
  currency: string;
  businessType: string;
  branches: BranchSeed[];
  staff: StaffSeed[];
  members: MemberSeed[];
  plans: MembershipPlanSeed[];
}

interface BranchSeed {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

interface StaffSeed {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  designation: string;
  salary: number;
  status: string;
}

interface MemberSeed {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  status: string;
  source: string;
  membershipStatus: string;
}

interface MembershipPlanSeed {
  planName: string;
  duration: number;
  durationUnit: string;
  price: number;
  status: string;
}

const GYMS: GymSeed[] = [
  {
    name: 'Iron Temple Fitness',
    slug: 'iron-temple-fitness',
    ownerName: 'Arjun Patel',
    ownerEmail: 'arjun@irontemple.com',
    ownerPassword: 'IronTemple@2024',
    phone: '+919876543210',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'IN',
    plan: 'pro',
    status: 'active',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    businessType: 'gym',
    branches: [
      { name: 'Iron Temple - Andheri', address: '123 Link Road, Andheri West', city: 'Mumbai', phone: '+919876543211', email: 'andheri@irontemple.com' },
      { name: 'Iron Temple - Bandra', address: '45 Hill Road, Bandra West', city: 'Mumbai', phone: '+919876543212', email: 'bandra@irontemple.com' },
    ],
    staff: [
      { fullName: 'Rahul Sharma', email: 'rahul@irontemple.com', phone: '+919876543220', role: 'manager', designation: 'Branch Manager', salary: 45000, status: 'active' },
      { fullName: 'Priya Desai', email: 'priya@irontemple.com', phone: '+919876543221', role: 'trainer', designation: 'Senior Trainer', salary: 35000, status: 'active' },
    ],
    members: [
      { fullName: 'Vikram Singh', email: 'vikram@example.com', phone: '+919800000001', gender: 'male', status: 'active', source: 'walk_in', membershipStatus: 'active' },
      { fullName: 'Neha Kapoor', email: 'neha@example.com', phone: '+919800000002', gender: 'female', status: 'active', source: 'referral', membershipStatus: 'active' },
      { fullName: 'Amit Verma', email: 'amit@example.com', phone: '+919800000003', gender: 'male', status: 'active', source: 'online', membershipStatus: 'active' },
      { fullName: 'Sneha Gupta', email: 'sneha@example.com', phone: '+919800000004', gender: 'female', status: 'active', source: 'walk_in', membershipStatus: 'active' },
      { fullName: 'Raj Malhotra', email: 'raj@example.com', phone: '+919800000005', gender: 'male', status: 'active', source: 'social_media', membershipStatus: 'expiring' },
      { fullName: 'Kavita Nair', email: 'kavita@example.com', phone: '+919800000006', gender: 'female', status: 'inactive', source: 'walk_in', membershipStatus: 'expired' },
      { fullName: 'Rohit Joshi', email: 'rohit.j@example.com', phone: '+919800000007', gender: 'male', status: 'active', source: 'referral', membershipStatus: 'active' },
      { fullName: 'Ananya Das', email: 'ananya@example.com', phone: '+919800000008', gender: 'female', status: 'active', source: 'online', membershipStatus: 'active' },
    ],
    plans: [
      { planName: 'Monthly Basic', duration: 1, durationUnit: 'month', price: 1500, status: 'active' },
      { planName: 'Quarterly Premium', duration: 3, durationUnit: 'month', price: 4000, status: 'active' },
      { planName: 'Annual Gold', duration: 12, durationUnit: 'month', price: 12000, status: 'active' },
    ],
  },
  {
    name: 'FitZone Academy',
    slug: 'fitzone-academy',
    ownerName: 'Meera Krishnan',
    ownerEmail: 'meera@fitzone.in',
    ownerPassword: 'FitZone@2024',
    phone: '+919876543300',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'IN',
    plan: 'starter',
    status: 'active',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    businessType: 'fitness_studio',
    branches: [
      { name: 'FitZone - Koramangala', address: '78 80 Feet Road, Koramangala', city: 'Bangalore', phone: '+919876543301', email: 'koramangala@fitzone.in' },
      { name: 'FitZone - Indiranagar', address: '12 100 Feet Road, Indiranagar', city: 'Bangalore', phone: '+919876543302', email: 'indiranagar@fitzone.in' },
    ],
    staff: [
      { fullName: 'Karthik Rajan', email: 'karthik@fitzone.in', phone: '+919876543310', role: 'trainer', designation: 'Head Trainer', salary: 40000, status: 'active' },
      { fullName: 'Lakshmi Iyer', email: 'lakshmi@fitzone.in', phone: '+919876543311', role: 'receptionist', designation: 'Front Desk', salary: 20000, status: 'active' },
    ],
    members: [
      { fullName: 'Deepak Rao', email: 'deepak.r@example.com', phone: '+919800100001', gender: 'male', status: 'active', source: 'walk_in', membershipStatus: 'active' },
      { fullName: 'Swathi Naidu', email: 'swathi@example.com', phone: '+919800100002', gender: 'female', status: 'active', source: 'online', membershipStatus: 'active' },
      { fullName: 'Harish Kumar', email: 'harish.k@example.com', phone: '+919800100003', gender: 'male', status: 'active', source: 'referral', membershipStatus: 'active' },
      { fullName: 'Divya Hegde', email: 'divya.h@example.com', phone: '+919800100004', gender: 'female', status: 'frozen', source: 'walk_in', membershipStatus: 'frozen' },
      { fullName: 'Suresh Gowda', email: 'suresh.g@example.com', phone: '+919800100005', gender: 'male', status: 'active', source: 'social_media', membershipStatus: 'active' },
    ],
    plans: [
      { planName: 'Monthly Fitness', duration: 1, durationUnit: 'month', price: 1200, status: 'active' },
      { planName: 'Half-Yearly Pack', duration: 6, durationUnit: 'month', price: 6000, status: 'active' },
    ],
  },
  {
    name: 'PowerLift Pro',
    slug: 'powerlift-pro',
    ownerName: 'Sanjay Mehta',
    ownerEmail: 'sanjay@powerliftpro.com',
    ownerPassword: 'PowerLift@2024',
    phone: '+919876543400',
    city: 'Delhi',
    state: 'Delhi',
    country: 'IN',
    plan: 'enterprise',
    status: 'active',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    businessType: 'gym',
    branches: [
      { name: 'PowerLift - Connaught Place', address: 'Block A, Connaught Place', city: 'Delhi', phone: '+919876543401', email: 'cp@powerliftpro.com' },
      { name: 'PowerLift - Hauz Khas', address: '15 Hauz Khas Village', city: 'Delhi', phone: '+919876543402', email: 'hk@powerliftpro.com' },
    ],
    staff: [
      { fullName: 'Manish Tiwari', email: 'manish@powerliftpro.com', phone: '+919876543410', role: 'manager', designation: 'Operations Manager', salary: 55000, status: 'active' },
      { fullName: 'Pooja Saxena', email: 'pooja@powerliftpro.com', phone: '+919876543411', role: 'trainer', designation: 'CrossFit Coach', salary: 38000, status: 'active' },
    ],
    members: [
      { fullName: 'Akhil Bhardwaj', email: 'akhil.b@example.com', phone: '+919800200001', gender: 'male', status: 'active', source: 'walk_in', membershipStatus: 'active' },
      { fullName: 'Ritu Sharma', email: 'ritu.s@example.com', phone: '+919800200002', gender: 'female', status: 'active', source: 'online', membershipStatus: 'active' },
      { fullName: 'Gaurav Pandey', email: 'gaurav.p@example.com', phone: '+919800200003', gender: 'male', status: 'active', source: 'referral', membershipStatus: 'active' },
      { fullName: 'Nisha Agarwal', email: 'nisha.a@example.com', phone: '+919800200004', gender: 'female', status: 'active', source: 'social_media', membershipStatus: 'active' },
      { fullName: 'Varun Khanna', email: 'varun.k@example.com', phone: '+919800200005', gender: 'male', status: 'active', source: 'walk_in', membershipStatus: 'active' },
      { fullName: 'Tanya Bhatia', email: 'tanya.b@example.com', phone: '+919800200006', gender: 'female', status: 'inactive', source: 'online', membershipStatus: 'expired' },
      { fullName: 'Nikhil Oberoi', email: 'nikhil.o@example.com', phone: '+919800200007', gender: 'male', status: 'active', source: 'walk_in', membershipStatus: 'active' },
      { fullName: 'Shruti Kapoor', email: 'shruti.k@example.com', phone: '+919800200008', gender: 'female', status: 'active', source: 'referral', membershipStatus: 'active' },
      { fullName: 'Aditya Reddy', email: 'aditya.r@example.com', phone: '+919800200009', gender: 'male', status: 'active', source: 'online', membershipStatus: 'expiring' },
      { fullName: 'Pallavi Jain', email: 'pallavi.j@example.com', phone: '+919800200010', gender: 'female', status: 'active', source: 'walk_in', membershipStatus: 'active' },
    ],
    plans: [
      { planName: 'Monthly Standard', duration: 1, durationUnit: 'month', price: 2000, status: 'active' },
      { planName: 'Quarterly Elite', duration: 3, durationUnit: 'month', price: 5500, status: 'active' },
      { planName: 'Annual Unlimited', duration: 12, durationUnit: 'month', price: 18000, status: 'active' },
    ],
  },
  {
    name: 'Zen Yoga Studio',
    slug: 'zen-yoga-studio',
    ownerName: 'Anita Deshmukh',
    ownerEmail: 'anita@zenyoga.in',
    ownerPassword: 'ZenYoga@2024',
    phone: '+919876543500',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'IN',
    plan: 'free',
    status: 'trial',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    businessType: 'yoga_studio',
    branches: [
      { name: 'Zen Yoga - Koregaon Park', address: '9 North Main Road, Koregaon Park', city: 'Pune', phone: '+919876543501', email: 'kp@zenyoga.in' },
    ],
    staff: [
      { fullName: 'Sunita Patil', email: 'sunita@zenyoga.in', phone: '+919876543510', role: 'trainer', designation: 'Yoga Instructor', salary: 25000, status: 'active' },
    ],
    members: [
      { fullName: 'Prashant More', email: 'prashant.m@example.com', phone: '+919800300001', gender: 'male', status: 'active', source: 'walk_in', membershipStatus: 'active' },
      { fullName: 'Megha Kulkarni', email: 'megha.k@example.com', phone: '+919800300002', gender: 'female', status: 'active', source: 'online', membershipStatus: 'active' },
      { fullName: 'Ajay Deshpande', email: 'ajay.d@example.com', phone: '+919800300003', gender: 'male', status: 'active', source: 'walk_in', membershipStatus: 'active' },
    ],
    plans: [
      { planName: 'Monthly Yoga', duration: 1, durationUnit: 'month', price: 800, status: 'active' },
      { planName: 'Quarterly Wellness', duration: 3, durationUnit: 'month', price: 2000, status: 'active' },
    ],
  },
];

// ── Seeding Functions ────────────────────────────────────────────────────────

async function seedPlans() {
  const count = await prisma.subscriptionPlan.count();
  if (count > 0) {
    console.log(`  -> ${count} plans already exist, skipping`);
    return;
  }

  const entries = Object.entries(PLAN_CONFIGS);
  for (let i = 0; i < entries.length; i++) {
    const [name, config] = entries[i];
    await prisma.subscriptionPlan.create({
      data: {
        name,
        display_name: config.display_name,
        description: config.description,
        monthly_price: config.monthly_price,
        annual_price: config.annual_price,
        max_branches: config.max_branches,
        max_members: config.max_members,
        max_staff: config.max_staff,
        storage_limit_gb: config.storage_limit_gb,
        api_access: config.api_access,
        features: config.features,
        plan_type: config.plan_type,
        sort_order: i,
      },
    });
    console.log(`  -> Created plan: ${config.display_name}`);
  }
}

async function seedReferralRules() {
  const count = await prisma.referralRewardRule.count();
  if (count > 0) {
    console.log(`  -> ${count} referral rules already exist, skipping`);
    return;
  }

  const rules = [
    {
      name: 'Refer a gym → +15 days',
      description: 'Default reward: any referred gym that subscribes earns the referrer 15 extra subscription days.',
      trigger_event: 'b2b_subscription_activated',
      conditions: {},
      rewards: [{ type: 'extend_subscription', days: 15 }],
      priority: 0,
      is_active: true,
    },
    {
      name: 'Annual subscriber → +30 days',
      description: 'Referred gym subscribing on an annual cycle earns the referrer 30 extra days.',
      trigger_event: 'b2b_subscription_activated',
      conditions: { billing_cycles: ['annual'] },
      rewards: [{ type: 'extend_subscription', days: 30 }],
      priority: 10,
      is_active: true,
    },
    {
      name: 'Wallet credit ₹500',
      description: 'Referred gym subscribes → referrer earns ₹500 referral wallet credit (expires in 180 days).',
      trigger_event: 'b2b_subscription_activated',
      conditions: { min_subscription_amount: 1000 },
      rewards: [{ type: 'wallet_credit', amount: 500, currency: 'INR', expires_in_days: 180 }],
      priority: 5,
      is_active: true,
    },
  ];

  for (const r of rules) {
    await prisma.referralRewardRule.create({
      data: {
        name: r.name,
        description: r.description,
        trigger_event: r.trigger_event,
        conditions: r.conditions as any,
        rewards: r.rewards as any,
        priority: r.priority,
        is_active: r.is_active,
      },
    });
    console.log(`  -> Created referral rule: ${r.name}`);
  }
}

async function cloneTenantSchema(targetSchema: string): Promise<void> {
  const sourceSchema = 'studio_template';

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    sourceSchema,
  );

  if (tables.length === 0) {
    console.log(`    WARNING: studio_template has no tables — run migrations first`);
    return;
  }

  console.log(`    Cloning ${tables.length} tables from ${sourceSchema} to ${targetSchema}`);

  for (const { table_name } of tables) {
    if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(table_name)) continue;
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${targetSchema}"."${table_name}"
       (LIKE "${sourceSchema}"."${table_name}" INCLUDING ALL)`,
    );
  }

  // Copy FK constraints
  const fks = await prisma.$queryRawUnsafe<{
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
  }[]>(
    `SELECT
       tc.constraint_name,
       tc.table_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name,
       rc.delete_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`,
    sourceSchema,
  );

  for (const fk of fks) {
    const onDelete = fk.delete_rule === 'CASCADE' ? 'ON DELETE CASCADE' : '';
    const fkName = `${targetSchema}_${fk.constraint_name}`;
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${targetSchema}"."${fk.table_name}"
         ADD CONSTRAINT "${fkName}"
         FOREIGN KEY ("${fk.column_name}")
         REFERENCES "${targetSchema}"."${fk.foreign_table_name}" ("${fk.foreign_column_name}")
         ${onDelete}`,
      );
    } catch {
      // Constraint may already exist on re-run
    }
  }
}

function generateMemberId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = randomBytes(2).toString('hex').toUpperCase();
  return `FS-${date}-${seq}`;
}

async function seedGym(gym: GymSeed, gymIdx: number): Promise<{ credentials: { email: string; password: string; gymName: string } }> {
  console.log(`\n  [${gymIdx + 1}/${GYMS.length}] Seeding "${gym.name}"...`);

  // Check if studio already exists
  const existing = await prisma.studio.findUnique({ where: { slug: gym.slug } });
  if (existing) {
    console.log(`    -> Studio "${gym.name}" already exists (slug: ${gym.slug}), skipping`);
    return { credentials: { email: gym.ownerEmail, password: gym.ownerPassword, gymName: gym.name } };
  }

  // ── Create Supabase Auth user (or reuse existing) ─────────────────────
  let ownerUserId: string;

  if (supabase) {
    // Check if user already exists in Supabase Auth
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = (listData?.users as Array<{ id: string; email?: string }>)
      ?.find((u) => u.email === gym.ownerEmail);

    if (existingUser) {
      ownerUserId = existingUser.id;
      // Update password and metadata in case they changed
      await supabase.auth.admin.updateUserById(ownerUserId, {
        password: gym.ownerPassword,
        user_metadata: {
          full_name: gym.ownerName,
          phone: gym.phone,
          role: 'owner',
          onboarding_step: 'complete',
        },
      });
      console.log(`    -> Supabase user exists: ${ownerUserId}`);
    } else {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: gym.ownerEmail,
        password: gym.ownerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: gym.ownerName,
          phone: gym.phone,
          role: 'owner',
          onboarding_step: 'complete',
        },
      });
      if (authError) {
        console.error(`    ERROR: Failed to create Supabase user for ${gym.ownerEmail}: ${authError.message}`);
        // Fall back to deterministic UUID
        ownerUserId = seedUUID('owner', gymIdx);
      } else {
        ownerUserId = authData.user.id;
        console.log(`    -> Supabase user created: ${ownerUserId}`);
      }
    }
  } else {
    // No Supabase config — use deterministic UUID (login won't work but data will seed)
    ownerUserId = seedUUID('owner', gymIdx);
    console.log(`    -> No SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY — using fallback UUID (login disabled)`);
  }

  const schemaName = `studio_${ownerUserId.replace(/-/g, '_')}`;
  const studioId = seedUUID('studio', gymIdx);

  // Determine trial end date
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  // Create Studio in public schema (upsert for idempotency)
  const studio = await prisma.studio.upsert({
    where: { id: studioId },
    update: { name: gym.name, subscription_status: gym.status },
    create: {
      id: studioId,
      name: gym.name,
      slug: gym.slug,
      schema_name: schemaName,
      owner_user_id: ownerUserId,
      phone: gym.phone,
      email: gym.ownerEmail,
      city: gym.city,
      state: gym.state,
      country: gym.country,
      business_type: gym.businessType,
      account_type: 'gym',
      timezone: gym.timezone,
      currency: gym.currency,
      subscription_plan: gym.plan,
      subscription_status: gym.status,
      subscription_start: now,
      trial_ends_at: trialEnd,
      email_verified: true,
      referral_code: randomBytes(3).toString('hex').toUpperCase(),
    },
  });
  console.log(`    -> Studio created: ${studio.id}`);

  // Create UserIdentity for the owner (upsert for idempotency)
  await prisma.userIdentity.upsert({
    where: { id: ownerUserId },
    create: {
      id: ownerUserId,
      email: gym.ownerEmail,
      full_name: gym.ownerName,
      phone: gym.phone,
      email_verified: true,
    },
    update: {
      email: gym.ownerEmail,
      full_name: gym.ownerName,
    },
  });

  // Update Supabase user metadata with studio_id and org info
  if (supabase) {
    await supabase.auth.admin.updateUserById(ownerUserId, {
      user_metadata: {
        full_name: gym.ownerName,
        phone: gym.phone,
        role: 'owner',
        studio_id: studioId,
        account_type: 'gym',
        onboarding_step: 'complete',
      },
    });
  }

  // Create tenant schema
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await cloneTenantSchema(schemaName);
  console.log(`    -> Schema "${schemaName}" created`);

  // All tenant data goes into studio_template (Prisma's @@schema target).
  // Per-tenant schemas exist for direct SQL/backup; Prisma ORM always queries studio_template.
  // gym_id column provides tenant isolation.
  const tenantTable = 'studio_template';

  // Create Organization
  const orgId = seedUUID('org', gymIdx);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${tenantTable}".organizations (id, gym_id, name, slug, country, timezone, currency, status, created_at, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'active', now(), now())`,
    orgId, studioId, gym.name, gym.slug, gym.country, gym.timezone, gym.currency,
  );
  console.log(`    -> Organization created`);

  // Create Branches
  const branchIds: string[] = [];
  for (let bi = 0; bi < gym.branches.length; bi++) {
    const branch = gym.branches[bi];
    const branchId = seedUUID(`branch-${gymIdx}`, bi);
    branchIds.push(branchId);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenantTable}".branches
        (id, gym_id, organization_id, name, address, city, phone, email, is_active, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, true, now(), now())`,
      branchId, studioId, orgId, branch.name, branch.address, branch.city,
      branch.phone, branch.email,
    );
  }
  console.log(`    -> ${branchIds.length} branches created`);

  // Create RBAC Roles
  const roles = ['owner', 'manager', 'trainer', 'receptionist'];
  const roleIds: Record<string, string> = {};
  for (let ri = 0; ri < roles.length; ri++) {
    const roleId = seedUUID(`role-${gymIdx}`, ri);
    roleIds[roles[ri]] = roleId;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenantTable}".roles (id, gym_id, name, is_system, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3, true, now(), now())
       ON CONFLICT DO NOTHING`,
      roleId, studioId, roles[ri],
    );
  }
  console.log(`    -> RBAC roles created`);

  // Create Staff
  const staffIds: string[] = [];
  for (let si = 0; si < gym.staff.length; si++) {
    const staff = gym.staff[si];
    const staffId = seedUUID(`staff-${gymIdx}`, si);
    staffIds.push(staffId);
    const assignedBranch = branchIds[si % branchIds.length];

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenantTable}".staff
        (id, gym_id, organization_id, branch_id, full_name, email, phone, role, job_title,
         salary, employment_type, joined_at, status, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9,
               $10, 'full_time', now(), $11, now(), now())`,
      staffId, studioId, orgId, assignedBranch, staff.fullName, staff.email,
      staff.phone, staff.role, staff.designation, staff.salary, staff.status,
    );
  }
  console.log(`    -> ${staffIds.length} staff created`);

  // Create Membership Plans
  const planIds: string[] = [];
  for (let pi = 0; pi < gym.plans.length; pi++) {
    const plan = gym.plans[pi];
    const planId = seedUUID(`mplan-${gymIdx}`, pi);
    planIds.push(planId);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenantTable}".membership_plans
        (id, gym_id, organization_id, name, plan_type, duration_days, price, is_active, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'duration', $5, $6, true, now(), now())`,
      planId, studioId, orgId, plan.planName,
      plan.duration * 30,
      plan.price,
    );
  }
  console.log(`    -> ${planIds.length} membership plans created`);

  // Create Members with Memberships
  const memberIds: string[] = [];
  for (let mi = 0; mi < gym.members.length; mi++) {
    const member = gym.members[mi];
    const memberId = seedUUID(`member-${gymIdx}`, mi);
    memberIds.push(memberId);
    const assignedBranch = branchIds[mi % branchIds.length];
    const memberIdCode = generateMemberId();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenantTable}".members
        (id, gym_id, organization_id, branch_id, member_code, full_name, email, phone,
         gender, status, checkin_method, engagement_score, churn_risk, join_date, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8,
               $9, $10, 'qr_code', 50, 0, now(), now(), now())`,
      memberId, studioId, orgId, assignedBranch, memberIdCode, member.fullName,
      member.email, member.phone, member.gender, member.status,
    );

    // Create membership for each member
    const membershipId = seedUUID(`membership-${gymIdx}`, mi);
    const selectedPlan = planIds[mi % planIds.length];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 6));
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + gym.plans[mi % planIds.length].duration);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenantTable}".member_memberships
        (id, gym_id, member_id, plan_id, branch_id, start_date, end_date, status, auto_renew, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, false, now(), now())`,
      membershipId, studioId, memberId, selectedPlan, assignedBranch, startDate, endDate,
      member.membershipStatus,
    );
  }
  console.log(`    -> ${memberIds.length} members with memberships created`);

  // Build member->membership mapping for check-ins
  const memberMembershipMap: Record<string, string> = {};
  for (let mi = 0; mi < memberIds.length; mi++) {
    memberMembershipMap[memberIds[mi]] = seedUUID(`membership-${gymIdx}`, mi);
  }

  // Create sample Check-ins (last 30 days)
  let checkInCount = 0;
  for (let day = 0; day < 30; day++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - day);

    // Random subset of active members check in each day
    const activeMembers = memberIds.filter((_, i) => gym.members[i].status === 'active');
    const dailyCheckIns = activeMembers.filter(() => Math.random() > 0.4);

    for (const memberId of dailyCheckIns) {
      const checkInId = randomUUID();
      const checkInTime = new Date(checkDate);
      checkInTime.setHours(6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));

      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tenantTable}".check_ins
          (id, gym_id, member_id, membership_id, branch_id, checked_in_at, checkin_method, status, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, 'success', now())`,
        checkInId, studioId, memberId, memberMembershipMap[memberId], branchIds[0],
        checkInTime, ['qr_code', 'manual', 'facial'][Math.floor(Math.random() * 3)],
      );
      checkInCount++;
    }
  }
  console.log(`    -> ${checkInCount} check-ins created (30-day history)`);

  // Create sample Payments
  let paymentCount = 0;
  for (let mi = 0; mi < memberIds.length; mi++) {
    const member = gym.members[mi];
    if (member.status === 'inactive') continue;

    const paymentId = randomUUID();
    const plan = gym.plans[mi % planIds.length];
    const paymentDate = new Date();
    paymentDate.setMonth(paymentDate.getMonth() - Math.floor(Math.random() * 3));

    const receiptNumber = `RCP-G${gymIdx}-${paymentDate.toISOString().slice(0,10).replace(/-/g,'')}-${String(paymentCount + 1).padStart(4, '0')}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${tenantTable}".payments
        (id, gym_id, member_id, branch_id, amount, currency, payment_method, status, receipt_number, paid_at, created_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, 'paid', $8, $9, now())`,
      paymentId, studioId, memberIds[mi], branchIds[0], plan.price, gym.currency,
      ['cash', 'card', 'upi'][Math.floor(Math.random() * 3)], receiptNumber, paymentDate,
    );
    paymentCount++;
  }
  console.log(`    -> ${paymentCount} payments created`);

  // Sync to SCC schema (if it exists)
  try {
    const sccStatus = gym.status === 'active' ? 'ACTIVE' : 'TRIAL';
    await prisma.$executeRawUnsafe(
      `INSERT INTO scc.tenants
        (id, name, slug, owner_email, owner_name, phone, account_type, status,
         is_active, trial_ends_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'gym',
               CAST($6 AS "scc"."TenantStatus"), true, $7, now(), now())
       ON CONFLICT (slug) DO NOTHING`,
      gym.name, gym.slug, gym.ownerEmail, gym.ownerName, gym.phone,
      sccStatus, trialEnd,
    );
    console.log(`    -> SCC tenant synced`);
  } catch {
    console.log(`    -> SCC schema not available, skipping sync`);
  }

  // Update Supabase user metadata with organization_id and branch_ids
  if (supabase) {
    await supabase.auth.admin.updateUserById(ownerUserId, {
      user_metadata: {
        full_name: gym.ownerName,
        phone: gym.phone,
        role: 'owner',
        studio_id: studioId,
        organization_id: orgId,
        branch_ids: branchIds,
        account_type: 'gym',
        onboarding_step: 'complete',
      },
    });
  }

  // Assign owner role in public schema
  try {
    await prisma.userRole.create({
      data: {
        user_id: ownerUserId,
        studio_id: studioId,
        role_name: 'owner',
        is_primary: true,
      },
    });
  } catch {
    // May already exist
  }

  // Reset search_path
  await prisma.$executeRawUnsafe(`SET search_path TO public`);

  return { credentials: { email: gym.ownerEmail, password: gym.ownerPassword, gymName: gym.name } };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding MuscleX database...\n');

  // Phase 1: Subscription Plans
  console.log('Phase 1: Subscription Plans');
  await seedPlans();

  // Phase 1b: Referral Reward Rules (B2B SaaS-level)
  console.log('\nPhase 1b: Referral Reward Rules');
  await seedReferralRules();

  // Phase 2: Sample Gyms (4 gyms with different plans/scenarios)
  console.log('\nPhase 2: Sample Gyms');
  console.log('  Gym scenarios:');
  console.log('    1. Iron Temple Fitness  - Pro plan, active, 2 branches, 8 members');
  console.log('    2. FitZone Academy      - Starter plan, active, 2 branches, 5 members');
  console.log('    3. PowerLift Pro        - Enterprise plan, active, 2 branches, 10 members');
  console.log('    4. Zen Yoga Studio      - Free plan, trial, 1 branch, 3 members');

  const allCredentials: { email: string; password: string; gymName: string }[] = [];

  for (let i = 0; i < GYMS.length; i++) {
    const { credentials } = await seedGym(GYMS[i], i);
    allCredentials.push(credentials);
  }

  // Reset search_path at the end
  await prisma.$executeRawUnsafe(`SET search_path TO public`);

  console.log('\n--- Seed Summary ---');
  console.log(`  Subscription Plans: ${Object.keys(PLAN_CONFIGS).length}`);
  console.log(`  Gyms:               ${GYMS.length}`);
  console.log(`  Total Branches:     ${GYMS.reduce((s, g) => s + g.branches.length, 0)}`);
  console.log(`  Total Staff:        ${GYMS.reduce((s, g) => s + g.staff.length, 0)}`);
  console.log(`  Total Members:      ${GYMS.reduce((s, g) => s + g.members.length, 0)}`);
  console.log(`  Total Plans:        ${GYMS.reduce((s, g) => s + g.plans.length, 0)}`);

  // Print login credentials
  console.log('\n========================================');
  console.log('       LOGIN CREDENTIALS');
  console.log('========================================');
  console.log('');
  for (const cred of allCredentials) {
    console.log(`  ${cred.gymName}`);
    console.log(`    Email:    ${cred.email}`);
    console.log(`    Password: ${cred.password}`);
    console.log('');
  }
  console.log('========================================');
  console.log(supabase
    ? 'Supabase Auth users created — login via /api/v1/auth/login'
    : 'WARNING: No SUPABASE_URL set — auth users NOT created (set env vars and re-run)');
  console.log('========================================');

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
