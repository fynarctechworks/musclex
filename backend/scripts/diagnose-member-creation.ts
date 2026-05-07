import { PrismaClient } from '@prisma/client';

const SCHEMA = process.argv[2] || 'studio_01b37479_06b4_4844_b138_0fd6a263f067';
const STUDIO_ID = process.argv[3] || '17b22e99-dd2a-49f7-8b64-63b3645bf588';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log(`\n=== Diagnosing member creation prerequisites ===`);
  console.log(`Schema: ${SCHEMA}`);
  console.log(`Studio ID (gym_id): ${STUDIO_ID}\n`);

  await prisma.$executeRawUnsafe(`SET search_path TO "${SCHEMA}", public`);

  // 1. Studio row (public schema)
  const studios = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, slug, subscription_plan, currency, timezone, country
     FROM public.studios WHERE id = $1::uuid`,
    STUDIO_ID,
  );
  console.log('1. Studio row (public.studios):');
  console.table(studios);

  // 2. Subscription plan
  const plan = studios[0]?.subscription_plan;
  if (plan) {
    const subPlans = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, max_members, max_branches, max_staff FROM public.subscription_plans WHERE name = $1`,
      plan,
    );
    console.log(`\n2. Subscription plan (name=${plan}):`);
    console.table(subPlans);
  }

  // 3. Organizations
  const orgs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, slug, gym_id, status FROM "${SCHEMA}".organizations WHERE gym_id = $1::uuid`,
    STUDIO_ID,
  );
  console.log('\n3. Organizations in tenant schema:');
  console.table(orgs);

  // 4. Branches
  const branches = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, gym_id, organization_id, is_active FROM "${SCHEMA}".branches WHERE gym_id = $1::uuid`,
    STUDIO_ID,
  );
  console.log('\n4. Branches in tenant schema:');
  console.table(branches);

  // 5. Membership plans
  const plans = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, price, gym_id, is_active FROM "${SCHEMA}".membership_plans WHERE gym_id = $1::uuid`,
    STUDIO_ID,
  );
  console.log('\n5. Membership plans in tenant schema:');
  console.table(plans);

  // 6. Members count
  const memberCount = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS count FROM "${SCHEMA}".members WHERE gym_id = $1::uuid`,
    STUDIO_ID,
  );
  console.log(`\n6. Existing member count: ${memberCount[0].count}`);

  // 7. Check the Member table columns to verify schema shape
  const cols = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'members'
     ORDER BY ordinal_position`,
    SCHEMA,
  );
  console.log('\n7. members table columns (first 15):');
  console.table(cols.slice(0, 15));

  // 8. Test: try to INSERT a dummy member to see what fails (rolled back)
  console.log('\n8. Attempting dry-run insert into members (will rollback)...');
  try {
    await prisma.$executeRawUnsafe(`BEGIN`);
    await prisma.$executeRawUnsafe(`SET LOCAL search_path TO "${SCHEMA}", public`);
    const branchId = branches[0]?.id;
    const orgId = orgs[0]?.id;
    if (!branchId) {
      console.log('   ✗ No branch to test with');
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${SCHEMA}".members (gym_id, member_code, branch_id, organization_id, full_name, phone, status)
         VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7)`,
        STUDIO_ID, 'TEST-DIAG-0001', branchId, orgId, 'Diagnostic Test', '+9999999999', 'active',
      );
      console.log('   ✓ Raw INSERT succeeds (rolling back)');
    }
    await prisma.$executeRawUnsafe(`ROLLBACK`);
  } catch (e: any) {
    console.log(`   ✗ INSERT FAILED: ${e.message}`);
    await prisma.$executeRawUnsafe(`ROLLBACK`).catch(() => {});
  }

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
