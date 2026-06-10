/**
 * Read-only inspection: where do the relevant tables live, and is the
 * idempotency_keys table / tenants.account_type column present?
 *
 * Run with: npx ts-node scripts/inspect-migrations.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string }>>(`
    SELECT table_schema, table_name
      FROM information_schema.tables
     WHERE table_schema IN ('public','scc')
       AND table_name   IN ('tenants','idempotency_keys')
     ORDER BY table_schema, table_name
  `);

  const columns = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string; column_name: string }>>(`
    SELECT table_schema, table_name, column_name
      FROM information_schema.columns
     WHERE table_schema IN ('public','scc')
       AND table_name   = 'tenants'
       AND column_name  = 'account_type'
     ORDER BY table_schema
  `);

  const idemPresent = tables.filter(t => t.table_name === 'idempotency_keys');
  const tenantsPresent = tables.filter(t => t.table_name === 'tenants');

  console.log('--- tables present (public + scc) ---');
  console.log(JSON.stringify(tables, null, 2));
  console.log('--- tenants.account_type column present ---');
  console.log(JSON.stringify(columns, null, 2));
  console.log('--- summary ---');
  console.log('tenants table in:', tenantsPresent.map(t => t.table_schema).join(', ') || '(none)');
  console.log('idempotency_keys table in:', idemPresent.map(t => t.table_schema).join(', ') || '(none)');
  console.log('account_type column in:', columns.map(c => c.table_schema).join(', ') || '(none)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
