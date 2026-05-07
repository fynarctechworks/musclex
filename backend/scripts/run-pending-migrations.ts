/**
 * One-shot pending-migration runner.
 *
 * Runs the four dashboard migrations introduced by the World #1 Dashboard
 * waves (Wave 2 / 5 / 6 / 7) against the live database. Each migration is
 * idempotent (CREATE TABLE IF NOT EXISTS + propagation across tenant
 * schemas), so re-running is safe.
 *
 * Usage: ts-node scripts/run-pending-migrations.ts
 */

import { Client } from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

const MIGRATIONS = [
  '20260506_add_dashboard_action_states',
  '20260506_add_dashboard_briefings',
  '20260507_add_push_subscriptions',
  '20260507_add_kpi_snapshots',
];

async function checkApplied(client: Client, name: string): Promise<boolean> {
  // Heuristic: if the studio_template-level table the migration creates
  // already exists, the migration is already applied (or partially so).
  const probes: Record<string, string> = {
    '20260506_add_dashboard_action_states':
      "SELECT 1 FROM information_schema.tables WHERE table_schema='studio_template' AND table_name='dashboard_action_states' LIMIT 1",
    '20260506_add_dashboard_briefings':
      "SELECT 1 FROM information_schema.tables WHERE table_schema='studio_template' AND table_name='dashboard_briefings' LIMIT 1",
    '20260507_add_push_subscriptions':
      "SELECT 1 FROM information_schema.tables WHERE table_schema='studio_template' AND table_name='push_subscriptions' LIMIT 1",
    '20260507_add_kpi_snapshots':
      "SELECT 1 FROM information_schema.tables WHERE table_schema='studio_template' AND table_name='dashboard_kpi_snapshots' LIMIT 1",
  };
  const probe = probes[name];
  if (!probe) return false;
  const r = await client.query(probe);
  return r.rowCount! > 0;
}

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set in environment');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('sslmode=') ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`✓ Connected to database`);

  for (const name of MIGRATIONS) {
    const file = resolve(
      __dirname,
      '..',
      'prisma',
      'migrations',
      name,
      'migration.sql',
    );
    let sql: string;
    try {
      sql = readFileSync(file, 'utf8');
    } catch (err) {
      console.warn(`✗ Skipping ${name} — file not found at ${file}`);
      continue;
    }

    const alreadyApplied = await checkApplied(client, name);
    if (alreadyApplied) {
      console.log(
        `→ ${name}: studio_template table already present — running anyway (idempotent CREATE IF NOT EXISTS)`,
      );
    } else {
      console.log(`→ ${name}: applying`);
    }

    try {
      await client.query(sql);
      console.log(`✓ ${name} OK`);
    } catch (err) {
      const e = err as Error;
      console.error(`✗ ${name} FAILED: ${e.message}`);
      // Stop on first failure so we don't cascade errors
      await client.end();
      process.exit(2);
    }
  }

  await client.end();
  console.log('\n✓ All migrations applied');
}

run().catch((err) => {
  console.error(err);
  process.exit(3);
});
