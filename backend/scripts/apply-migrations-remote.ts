/**
 * Applies the pending SQL migrations to the REMOTE production database.
 *
 *   node ... apply-migrations-remote.ts --commit
 *
 * ONE TRANSACTION PER FILE, never one around all of them: three of the
 * manual-migrations files open and COMMIT their own transaction, so an outer
 * BEGIN is silently ended by the first of them and everything afterwards runs
 * in autocommit — an outer ROLLBACK then reports success while having undone
 * nothing. Files that manage their own transaction are run verbatim; the rest
 * are wrapped here.
 *
 * Order is resolved by repeated passes rather than hand-maintained: the files
 * have real dependencies (20260821_mentions references activity_comments, which
 * 20260821_social creates) that filename order does not encode. A file failing
 * on a missing relation is deferred and retried once its prerequisite exists;
 * a pass that makes no progress means a genuine error.
 *
 * Every statement is additive and IF NOT EXISTS guarded, so re-running is a
 * no-op and a partial application is safe to resume.
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Files are passed explicitly, never globbed: applying every migration in the
// tree to a live database is how an old DROP gets replayed. The caller decides
// what is pending.
const FILES = process.argv.slice(2).filter((a) => a.endsWith('.sql')).map((f) => path.resolve(f));
const label = (f: string) => `${path.basename(path.dirname(f))}/${path.basename(f)}`;
const selfManaged = (sql: string) => /^\s*BEGIN\s*;/im.test(sql);

(async () => {
  if (!FILES.length) { console.error('no .sql files given'); process.exit(1); }
  if (!process.argv.includes('--commit')) {
    console.error('refusing to run without --commit (these files COMMIT themselves; there is no dry run)');
    process.exit(1);
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  console.log(`${FILES.length} files -> production\n`);

  let pending = [...FILES];
  const done: string[] = [];
  let pass = 0;
  while (pending.length) {
    pass++;
    const failed: { f: string; msg: string }[] = [];
    console.log(`── pass ${pass} (${pending.length} pending)`);
    for (const f of pending) {
      const sql = fs.readFileSync(f, 'utf8');
      const own = selfManaged(sql);
      try {
        const t0 = process.hrtime.bigint();
        if (own) await c.query(sql);
        else { await c.query('BEGIN'); await c.query(sql); await c.query('COMMIT'); }
        console.log(`  ok    ${label(f)}${own ? ' [own tx]' : ''}  (${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)}ms)`);
        done.push(f);
      } catch (e: any) {
        try { await c.query('ROLLBACK'); } catch { /* already out of a tx */ }
        console.log(`  defer ${label(f)}  (${e.message})`);
        failed.push({ f, msg: e.message });
      }
    }
    if (failed.length === pending.length) {
      console.error(`\nSTUCK on pass ${pass} — these are real errors, not ordering:`);
      failed.forEach(x => console.error(`    ${label(x.f)}: ${x.msg}`));
      process.exitCode = 1;
      break;
    }
    pending = failed.map(x => x.f);
  }
  console.log(`\napplied ${done.length}/${FILES.length} in ${pass} pass(es).`);
  await c.end();
})();
