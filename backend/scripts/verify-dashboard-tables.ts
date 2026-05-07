/**
 * Verifies the four dashboard-wave tables landed in studio_template AND
 * propagated to every tenant schema. Prints a summary table.
 */

import { Client } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

const TABLES = [
  'dashboard_action_states',
  'dashboard_action_receipts',
  'dashboard_briefings',
  'push_subscriptions',
  'dashboard_kpi_snapshots',
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Find every studio_* schema
  const schemasRes = await client.query(
    `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'studio_%' ORDER BY nspname`,
  );
  const schemas: string[] = schemasRes.rows.map((r: any) => r.nspname);

  console.log(`\nFound ${schemas.length} studio schema(s):\n`);
  for (const schema of schemas) {
    const present: string[] = [];
    const missing: string[] = [];
    for (const t of TABLES) {
      const r = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
        [schema, t],
      );
      if (r.rowCount! > 0) present.push(t);
      else missing.push(t);
    }
    const ok = missing.length === 0;
    console.log(
      `${ok ? '✓' : '✗'} ${schema}: ${present.length}/${TABLES.length} tables present` +
        (missing.length > 0 ? `   (missing: ${missing.join(', ')})` : ''),
    );
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
