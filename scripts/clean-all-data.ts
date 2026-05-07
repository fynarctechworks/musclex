/**
 * MuscleX — Full Database Wipe
 *
 * Supabase-safe: runs each statement in its own transaction
 * to stay under max_locks_per_transaction.
 *
 * Usage:  npx ts-node scripts/clean-all-data.ts
 *   (run from the backend/ directory)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function exec(sql: string, label?: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    if (label) console.log(`  ✓ ${label}`);
  } catch (e: any) {
    // Ignore "does not exist" errors for tables that may not be in every schema
    if (e.code === 'P2010' && e.message?.includes('does not exist')) {
      if (label) console.log(`  - ${label} (skipped — not found)`);
    } else {
      console.error(`  ✗ ${label ?? sql}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('\n🔴 FULL DATABASE WIPE — Starting...\n');

  // ── 1. Find all tenant schemas ──
  const schemas: { nspname: string }[] = await prisma.$queryRawUnsafe(
    `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template' ORDER BY nspname`
  );
  console.log(`Found ${schemas.length} tenant schema(s)\n`);

  // ── 2. For each tenant schema: delete data, drop tables, drop schema ──
  for (const { nspname: schema } of schemas) {
    console.log(`Cleaning schema: ${schema}`);

    // Get all tables in this schema
    const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = '${schema}' ORDER BY tablename`
    );

    if (tables.length === 0) {
      // Empty schema — just drop it
      await exec(`DROP SCHEMA IF EXISTS "${schema}"`, `DROP SCHEMA ${schema}`);
      continue;
    }

    // Disable FK checks for this session
    await exec(`SET session_replication_role = 'replica'`);

    // DELETE from each table individually (each is its own transaction)
    for (const { tablename } of tables) {
      await exec(`DELETE FROM "${schema}"."${tablename}"`, `DELETE ${tablename}`);
    }

    // Re-enable FK checks
    await exec(`SET session_replication_role = 'origin'`);

    // Drop each table individually (no CASCADE needed since data is gone)
    for (const { tablename } of tables) {
      await exec(`DROP TABLE IF EXISTS "${schema}"."${tablename}" CASCADE`, `DROP TABLE ${tablename}`);
    }

    // Drop the now-empty schema
    await exec(`DROP SCHEMA IF EXISTS "${schema}"`, `DROP SCHEMA`);
    console.log(`  ✓ Schema dropped\n`);
  }

  // ── 3. Clean studio_template ──
  console.log('Cleaning schema: studio_template');

  const templateTables: { tablename: string }[] = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'studio_template' ORDER BY tablename`
  );

  await exec(`SET session_replication_role = 'replica'`);
  for (const { tablename } of templateTables) {
    await exec(`DELETE FROM "studio_template"."${tablename}"`, `DELETE ${tablename}`);
  }
  await exec(`SET session_replication_role = 'origin'`);
  console.log('  ✓ studio_template cleaned\n');

  // ── 4. Clean public schema ──
  console.log('Cleaning schema: public');

  const publicTables = [
    'reward_logs',
    'referral_reward_rules',
    'referral_campaigns',
    'referrals',
    'staff_invitations',
    'user_roles',
    'backup_codes',
    'user_sessions',
    'login_history',
    'user_devices',
    'user_identities',
    'email_verifications',
    'pending_registrations',
    'permissions',
    'invoices',
    'subscription_plans',
    'studios',
  ];

  await exec(`SET session_replication_role = 'replica'`);
  for (const table of publicTables) {
    await exec(`DELETE FROM "public"."${table}"`, `DELETE ${table}`);
  }
  await exec(`SET session_replication_role = 'origin'`);
  console.log('  ✓ public schema cleaned\n');

  console.log('✅ Database is now completely empty.');
  console.log('   Next steps:');
  console.log('   1. npx prisma db seed');
  console.log('   2. Register a new user through the app\n');
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
