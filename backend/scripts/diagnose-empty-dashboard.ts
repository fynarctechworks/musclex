/**
 * Diagnose why the dashboard is returning empty data.
 *
 * Checks:
 *   1. Count of rows in studio_template.* tables (hot dashboard tables).
 *   2. Rows with NULL gym_id (would be filtered out by $use middleware).
 *   3. Distinct gym_id values vs. studio UUIDs in public.studios.
 *   4. Whether the session variable app.gym_id is being set on queries.
 *
 * Run: cd backend && npx ts-node -r dotenv/config scripts/diagnose-empty-dashboard.ts
 */
import { PrismaClient } from '@prisma/client';

const HOT_TABLES = [
  'members',
  'branches',
  'staff',
  'payments',
  'check_ins',
  'membership_plans',
  'member_memberships',
  'classes',
];

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log('\n=== STUDIOS IN public.studios ===');
  const studios = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; schema_name: string }>
  >(`SELECT id, name, schema_name FROM public.studios ORDER BY created_at DESC LIMIT 10`);
  console.table(studios);

  console.log('\n=== ROW COUNTS IN studio_template.* (hot dashboard tables) ===');
  for (const tbl of HOT_TABLES) {
    try {
      const [{ total }] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COUNT(*)::bigint AS total FROM studio_template."${tbl}"`,
      );
      const [{ null_count }] = await prisma.$queryRawUnsafe<Array<{ null_count: bigint }>>(
        `SELECT COUNT(*)::bigint AS null_count FROM studio_template."${tbl}" WHERE gym_id IS NULL`,
      );
      const distinct = await prisma.$queryRawUnsafe<Array<{ gym_id: string | null; n: bigint }>>(
        `SELECT gym_id, COUNT(*)::bigint AS n FROM studio_template."${tbl}" GROUP BY gym_id ORDER BY n DESC LIMIT 5`,
      );
      const byGym = distinct
        .map((r) => `${r.gym_id ?? 'NULL'}=${r.n}`)
        .join(', ');
      console.log(
        `  ${tbl.padEnd(22)} total=${total}  null_gym_id=${null_count}  by_gym=[${byGym}]`,
      );
    } catch (err: any) {
      console.log(`  ${tbl.padEnd(22)} ERROR: ${err.message}`);
    }
  }

  console.log('\n=== RLS STATUS (members, branches, payments) ===');
  const rls = await prisma.$queryRawUnsafe<
    Array<{ schemaname: string; tablename: string; rowsecurity: boolean; relforcerowsecurity: boolean }>
  >(
    `SELECT n.nspname AS schemaname, c.relname AS tablename, c.relrowsecurity AS rowsecurity, c.relforcerowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'studio_template' AND c.relname IN ('members','branches','payments','staff','check_ins')`,
  );
  console.table(rls);

  console.log('\n=== RLS POLICIES ON TENANT TABLES ===');
  const policies = await prisma.$queryRawUnsafe<
    Array<{ schemaname: string; tablename: string; policyname: string; qual: string }>
  >(
    `SELECT schemaname, tablename, policyname, qual
     FROM pg_policies
     WHERE schemaname = 'studio_template'
     ORDER BY tablename LIMIT 20`,
  );
  console.table(policies);

  console.log('\n=== TEST: simulate dashboard query for first studio ===');
  if (studios.length > 0) {
    const gymId = studios[0].id;
    console.log(`Setting app.gym_id = ${gymId}`);
    await prisma.$queryRaw`SELECT set_config('app.gym_id', ${gymId}, false)`;
    const [{ n: memberCount }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM studio_template.members WHERE gym_id = $1::uuid`,
      gymId,
    );
    console.log(`Members matching gym_id=${gymId}: ${memberCount}`);

    const [{ n: allMembers }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM studio_template.members`,
    );
    console.log(`Total members in studio_template.members (RLS applied): ${allMembers}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
