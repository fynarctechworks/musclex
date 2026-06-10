/**
 * Applies every .sql file in prisma/migrations/ via the configured Prisma
 * connection. Each file is idempotent (IF NOT EXISTS guards), so this is
 * safe to re-run. Reports which DDL statement ran and whether it changed
 * anything by re-checking information_schema afterwards.
 *
 * Run with: npx ts-node scripts/apply-migrations.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

/**
 * Split a SQL script on `;` boundaries while respecting:
 *   - `$$` dollar-quoted blocks (used by Postgres DO blocks / functions)
 *   - single-quote string literals (incl. doubled-quote escapes)
 *   - `--` line comments
 *   - `/* ... *\/` block comments
 */
function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDollar = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      buf += ch;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; buf += '*/'; i++; continue; }
      buf += ch;
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && next === "'") { buf += "'"; i++; continue; }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDollar) {
      buf += ch;
      if (ch === '$' && next === '$') { buf += '$'; inDollar = false; i++; }
      continue;
    }

    if (ch === '-' && next === '-') { inLineComment = true; buf += '--'; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; buf += '/*'; i++; continue; }
    if (ch === "'") { inSingle = true; buf += ch; continue; }
    if (ch === '$' && next === '$') { inDollar = true; buf += '$$'; i++; continue; }

    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt.length > 0) out.push(stmt);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

async function applyFile(file: string) {
  const fullPath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`\n>>> Applying ${file}`);
  const statements = splitSql(sql)
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    const preview = stmt.slice(0, 80).replace(/\s+/g, ' ');
    process.stdout.write(`  -> ${preview}${stmt.length > 80 ? '...' : ''}\n`);
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log(`<<< Done: ${file}`);
}

async function verify() {
  const tables = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string }>>(`
    SELECT table_schema, table_name
      FROM information_schema.tables
     WHERE table_schema IN ('public','scc')
       AND table_name   IN ('tenants','idempotency_keys')
     ORDER BY table_schema, table_name
  `);
  const accountTypeCol = await prisma.$queryRawUnsafe<Array<{ table_schema: string }>>(`
    SELECT table_schema
      FROM information_schema.columns
     WHERE table_schema IN ('public','scc')
       AND table_name   = 'tenants'
       AND column_name  = 'account_type'
  `);
  const idemCols = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(`
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_schema = 'scc'
       AND table_name   = 'idempotency_keys'
     ORDER BY ordinal_position
  `);

  console.log('\n=== POST-APPLY VERIFICATION ===');
  console.log('tables present:', tables);
  console.log('account_type column present in:', accountTypeCol.map((c) => c.table_schema));
  console.log('idempotency_keys columns:');
  for (const c of idemCols) console.log(`  - ${c.column_name} : ${c.data_type}`);
}

async function main() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  console.log(`Found ${files.length} migration files: ${files.join(', ')}`);
  for (const file of files) {
    await applyFile(file);
  }
  await verify();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
