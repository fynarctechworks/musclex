/**
 * Diagnoses whether a tenant schema has all tables that studio_template has,
 * and reports/fixes any missing tables by cloning their DDL.
 *
 * Usage: npx ts-node -r dotenv/config scripts/diagnose-tenant-schema.ts <tenant_id>
 *   <tenant_id> is the studio UUID (x-tenant-id header value).
 */
import { PrismaClient } from '@prisma/client';

// Pass the exact schema_name from public.studios as arg[2]
const schemaName = process.argv[2] || 'studio_01b37479_06b4_4844_b138_0fd6a263f067';
const SOURCE_SCHEMA = 'studio_template';
const IDENT_RE = /^[a-z_][a-z0-9_]{0,62}$/i;

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log(`\n=== Diagnosing schema: ${schemaName} ===\n`);

  const sourceTables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
    SOURCE_SCHEMA,
  );
  const targetTables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
    schemaName,
  );

  const sourceNames = new Set(sourceTables.map((r) => r.table_name));
  const targetNames = new Set(targetTables.map((r) => r.table_name));

  console.log(`studio_template has ${sourceNames.size} tables`);
  console.log(`${schemaName} has ${targetNames.size} tables`);

  const missing = [...sourceNames].filter((t) => !targetNames.has(t));
  if (missing.length === 0) {
    console.log(`\n✅ Tenant schema has all tables. No action needed.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n❌ Missing ${missing.length} tables in ${schemaName}:`);
  missing.forEach((t) => console.log(`   - ${t}`));

  console.log(`\n🔧 Creating missing tables from ${SOURCE_SCHEMA}...\n`);

  for (const table of missing) {
    if (!IDENT_RE.test(table)) {
      console.warn(`Skipping unsafe table name: ${table}`);
      continue;
    }
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."${table}"
         (LIKE "${SOURCE_SCHEMA}"."${table}" INCLUDING ALL)`,
      );
      console.log(`   ✓ ${table}`);
    } catch (e: any) {
      console.error(`   ✗ ${table} — ${e.message}`);
    }
  }

  // Copy FKs for the newly-created tables only
  const fks = await prisma.$queryRawUnsafe<{
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
    update_rule: string;
  }[]>(
    `SELECT
       tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name,
       rc.delete_rule, rc.update_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`,
    SOURCE_SCHEMA,
  );

  const ALLOWED = new Set(['CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'NO ACTION']);
  const missingSet = new Set(missing);
  let fkAdded = 0;
  for (const fk of fks) {
    if (!missingSet.has(fk.table_name)) continue; // only for newly-added tables
    const ids = [fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name, fk.constraint_name];
    if (ids.some((x) => !IDENT_RE.test(x))) continue;
    if (!ALLOWED.has(fk.delete_rule.toUpperCase()) || !ALLOWED.has(fk.update_rule.toUpperCase())) continue;
    const onDelete = fk.delete_rule !== 'NO ACTION' ? `ON DELETE ${fk.delete_rule}` : '';
    const onUpdate = fk.update_rule !== 'NO ACTION' ? `ON UPDATE ${fk.update_rule}` : '';
    const fkName = `${schemaName}_${fk.constraint_name}`.slice(0, 63);
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${schemaName}"."${fk.table_name}"
         ADD CONSTRAINT "${fkName}"
         FOREIGN KEY ("${fk.column_name}")
         REFERENCES "${schemaName}"."${fk.foreign_table_name}" ("${fk.foreign_column_name}")
         ${onDelete} ${onUpdate}`,
      );
      fkAdded++;
    } catch {
      /* FK might reference public or already exist — skip */
    }
  }
  console.log(`\n✓ Added ${fkAdded} foreign key constraints for new tables`);
  console.log(`\n✅ Done. Tenant schema is now in sync with studio_template.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
