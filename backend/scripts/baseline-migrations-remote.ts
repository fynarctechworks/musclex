/**
 * Baseline production's _prisma_migrations table.
 *
 *   node -r dotenv/config -r ts-node/register scripts/baseline-migrations-remote.ts \
 *     [--commit] dotenv_config_path=.env.remote
 *
 * WHY
 * public._prisma_migrations is EMPTY while prisma/migrations holds 69 folders,
 * because this database has always been migrated by hand. Prisma reads that as
 * "no migration has ever run", so `prisma migrate deploy` would try to replay
 * all 69 against a database that already has their effects — and some of them
 * DROP indexes and rewrite columns. Recording them as already-applied makes
 * deploy a no-op, which is what it should be.
 *
 * This is only safe because the schema was verified to match schema.prisma
 * first (0 missing tables, 0 missing columns). It writes bookkeeping rows ONLY
 * — no table, column or row of real data is touched.
 *
 * The checksum is the sha256 of migration.sql, the same value Prisma computes,
 * so `prisma migrate status` validates instead of reporting corruption.
 */
import { Client } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.resolve('prisma/migrations');

(async () => {
  const commit = process.argv.includes('--commit');
  const names = fs.readdirSync(DIR)
    .filter((d) => fs.existsSync(path.join(DIR, d, 'migration.sql')))
    .sort();

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const existing = new Set(
    (await c.query('SELECT migration_name FROM public._prisma_migrations')).rows.map((r: any) => r.migration_name),
  );
  const todo = names.filter((n) => !existing.has(n));
  console.log(`${names.length} migrations on disk, ${existing.size} already recorded, ${todo.length} to record`);
  if (!commit) {
    console.log('\nDRY RUN — pass --commit to write. Would record:');
    todo.slice(0, 8).forEach((n) => console.log('  ' + n));
    if (todo.length > 8) console.log(`  … and ${todo.length - 8} more`);
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    for (const n of todo) {
      const sql = fs.readFileSync(path.join(DIR, n, 'migration.sql'));
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      await c.query(
        `INSERT INTO public._prisma_migrations
           (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)
         ON CONFLICT (id) DO NOTHING`,
        [checksum, n],
      );
    }
    await c.query('COMMIT');
    console.log(`\nrecorded ${todo.length} migrations as applied.`);
  } catch (e: any) {
    await c.query('ROLLBACK');
    console.error('failed, rolled back: ' + e.message);
    process.exitCode = 1;
  }
  const n = (await c.query('SELECT count(*)::int n FROM public._prisma_migrations')).rows[0].n;
  console.log(`_prisma_migrations now holds ${n} rows.`);
  await c.end();
})();
