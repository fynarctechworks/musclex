/**
 * Repair script: finds every studio whose tenant schema is missing or empty
 * and clones studio_template into it.
 *
 * Usage: npx ts-node scripts/repair-tenant-schemas.ts [schema_name]
 *   - With no arg: scans all studios and repairs any broken tenant schema.
 *   - With schema_name: repairs only that one.
 */
import { PrismaClient } from '@prisma/client';

const SOURCE = 'studio_template';
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/i;
const ALLOWED_FK = new Set(['CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'NO ACTION']);

async function cloneSchema(prisma: PrismaClient, target: string): Promise<void> {
  if (!/^studio_[0-9a-f_]+$/i.test(target)) {
    throw new Error(`Invalid target schema name: ${target}`);
  }

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${target}"`);

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    SOURCE,
  );
  if (tables.length === 0) {
    throw new Error(`Source schema "${SOURCE}" has no tables`);
  }

  console.log(`  Cloning ${tables.length} tables from ${SOURCE} → ${target}`);
  for (const { table_name } of tables) {
    if (!IDENT.test(table_name)) continue;
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${target}"."${table_name}"
       (LIKE "${SOURCE}"."${table_name}" INCLUDING ALL)`,
    );
  }

  const fks = await prisma.$queryRawUnsafe<{
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
    update_rule: string;
  }[]>(
    `SELECT tc.constraint_name, tc.table_name, kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.delete_rule, rc.update_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`,
    SOURCE,
  );

  let fkOk = 0, fkSkipped = 0;
  for (const fk of fks) {
    const ids = [fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name, fk.constraint_name];
    if (ids.some((id) => !IDENT.test(id))) { fkSkipped++; continue; }
    if (!ALLOWED_FK.has(fk.delete_rule.toUpperCase()) || !ALLOWED_FK.has(fk.update_rule.toUpperCase())) {
      fkSkipped++; continue;
    }
    const onDelete = fk.delete_rule !== 'NO ACTION' ? `ON DELETE ${fk.delete_rule}` : '';
    const onUpdate = fk.update_rule !== 'NO ACTION' ? `ON UPDATE ${fk.update_rule}` : '';
    const fkName = `${target}_${fk.constraint_name}`.slice(0, 63);
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${target}"."${fk.table_name}"
         ADD CONSTRAINT "${fkName}"
         FOREIGN KEY ("${fk.column_name}")
         REFERENCES "${target}"."${fk.foreign_table_name}" ("${fk.foreign_column_name}")
         ${onDelete} ${onUpdate}`,
      );
      fkOk++;
    } catch {
      fkSkipped++;
    }
  }
  console.log(`  ✓ ${target}: ${tables.length} tables, ${fkOk} FKs added, ${fkSkipped} FKs skipped`);
}

async function countTables(prisma: PrismaClient, schema: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
    schema,
  );
  return rows[0]?.count ?? 0;
}

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const arg = process.argv[2];

  if (arg) {
    console.log(`Repairing single schema: ${arg}`);
    await cloneSchema(prisma, arg);
    await prisma.$disconnect();
    return;
  }

  console.log('Scanning all studios…');
  const studios = await prisma.$queryRawUnsafe<{ id: string; name: string; schema_name: string }[]>(
    `SELECT id, name, schema_name FROM public.studios WHERE schema_name IS NOT NULL ORDER BY created_at DESC`,
  );
  console.log(`Found ${studios.length} studios`);

  let repaired = 0, ok = 0, skipped = 0;
  for (const s of studios) {
    if (!/^studio_[0-9a-f_]+$/i.test(s.schema_name)) {
      console.log(`  - ${s.name} (${s.schema_name}): SKIP (unsafe name)`);
      skipped++;
      continue;
    }
    const count = await countTables(prisma, s.schema_name);
    if (count === 0) {
      console.log(`  - ${s.name} (${s.schema_name}): EMPTY — cloning…`);
      try {
        await cloneSchema(prisma, s.schema_name);
        repaired++;
      } catch (e: any) {
        console.log(`    ✗ FAILED: ${e.message}`);
        skipped++;
      }
    } else {
      ok++;
    }
  }
  console.log(`\nDone. ${ok} already OK, ${repaired} repaired, ${skipped} skipped.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
