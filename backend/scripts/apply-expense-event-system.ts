/**
 * Applies the expense_event_system DDL (migration 20260415) to:
 *   1. studio_template (so new tenants inherit it on clone)
 *   2. Every live studio_<uuid> schema
 *
 * Idempotent — safe to re-run.
 *
 * Usage: npx ts-node scripts/apply-expense-event-system.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function statementsFor(schema: string): string[] {
  const q = `"${schema}"`;
  return [
    // 1. Widen amount (no-op if already numeric(12,2))
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = '${schema}' AND table_name = 'expenses' AND column_name = 'amount'
           AND (numeric_precision <> 12 OR numeric_scale <> 2)
       ) THEN
         ALTER TABLE ${q}."expenses" ALTER COLUMN "amount" TYPE numeric(12, 2);
       END IF;
     END $$`,

    // 2. New columns
    `ALTER TABLE ${q}."expenses"
       ADD COLUMN IF NOT EXISTS "category_id"     uuid,
       ADD COLUMN IF NOT EXISTS "vendor"          text,
       ADD COLUMN IF NOT EXISTS "notes"           text,
       ADD COLUMN IF NOT EXISTS "payment_method"  text   NOT NULL DEFAULT 'cash',
       ADD COLUMN IF NOT EXISTS "status"          text   NOT NULL DEFAULT 'confirmed',
       ADD COLUMN IF NOT EXISTS "reference_id"    uuid,
       ADD COLUMN IF NOT EXISTS "idempotency_key" text`,

    // 3. Indexes on expenses
    `CREATE INDEX IF NOT EXISTS "expenses_branch_id_expense_date_idx"
       ON ${q}."expenses" ("branch_id", "expense_date")`,
    `CREATE INDEX IF NOT EXISTS "expenses_branch_id_status_idx"
       ON ${q}."expenses" ("branch_id", "status")`,
    `CREATE INDEX IF NOT EXISTS "expenses_category_id_idx"
       ON ${q}."expenses" ("category_id")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "expenses_gym_id_idempotency_key_key"
       ON ${q}."expenses" ("gym_id", "idempotency_key")
       WHERE "idempotency_key" IS NOT NULL`,

    // 4. expense_categories
    `CREATE TABLE IF NOT EXISTS ${q}."expense_categories" (
       "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
       "gym_id"     uuid        NOT NULL,
       "branch_id"  uuid,
       "name"       text        NOT NULL,
       "slug"       text        NOT NULL,
       "icon"       text,
       "color"      text,
       "is_default" boolean     NOT NULL DEFAULT false,
       "is_active"  boolean     NOT NULL DEFAULT true,
       "sort_order" integer     NOT NULL DEFAULT 0,
       "created_at" timestamptz NOT NULL DEFAULT now(),
       "updated_at" timestamptz NOT NULL DEFAULT now(),
       CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_gym_id_branch_id_slug_key"
       ON ${q}."expense_categories" ("gym_id", "branch_id", "slug")`,
    `CREATE INDEX IF NOT EXISTS "expense_categories_gym_id_branch_id_is_active_idx"
       ON ${q}."expense_categories" ("gym_id", "branch_id", "is_active")`,

    // 5. expense_metrics
    `CREATE TABLE IF NOT EXISTS ${q}."expense_metrics" (
       "id"            uuid           NOT NULL DEFAULT gen_random_uuid(),
       "gym_id"        uuid           NOT NULL,
       "branch_id"     uuid           NOT NULL,
       "period_type"   text           NOT NULL,
       "period_key"    text           NOT NULL,
       "category_id"   uuid,
       "total_amount"  numeric(14, 2) NOT NULL DEFAULT 0,
       "expense_count" integer        NOT NULL DEFAULT 0,
       "currency"      text           NOT NULL DEFAULT 'INR',
       "updated_at"    timestamptz    NOT NULL DEFAULT now(),
       CONSTRAINT "expense_metrics_pkey" PRIMARY KEY ("id")
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "expense_metrics_unique_key"
       ON ${q}."expense_metrics" ("gym_id", "branch_id", "period_type", "period_key", "category_id")`,
    `CREATE INDEX IF NOT EXISTS "expense_metrics_lookup_idx"
       ON ${q}."expense_metrics" ("gym_id", "branch_id", "period_type", "period_key")`,

    // 6. Foreign keys — guarded
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.table_constraints
         WHERE table_schema = '${schema}' AND table_name = 'expenses'
           AND constraint_name = 'expenses_category_id_fkey'
       ) THEN
         ALTER TABLE ${q}."expenses"
           ADD CONSTRAINT "expenses_category_id_fkey"
             FOREIGN KEY ("category_id")
             REFERENCES ${q}."expense_categories" ("id")
             ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
     END $$`,

    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.table_constraints
         WHERE table_schema = '${schema}' AND table_name = 'expenses'
           AND constraint_name = 'expenses_reference_id_fkey'
       ) THEN
         ALTER TABLE ${q}."expenses"
           ADD CONSTRAINT "expenses_reference_id_fkey"
             FOREIGN KEY ("reference_id")
             REFERENCES ${q}."expenses" ("id")
             ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
     END $$`,

    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.table_constraints
         WHERE table_schema = '${schema}' AND table_name = 'expense_categories'
           AND constraint_name = 'expense_categories_branch_id_fkey'
       ) THEN
         ALTER TABLE ${q}."expense_categories"
           ADD CONSTRAINT "expense_categories_branch_id_fkey"
             FOREIGN KEY ("branch_id")
             REFERENCES ${q}."branches" ("id")
             ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$`,

    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.table_constraints
         WHERE table_schema = '${schema}' AND table_name = 'expense_metrics'
           AND constraint_name = 'expense_metrics_branch_id_fkey'
       ) THEN
         ALTER TABLE ${q}."expense_metrics"
           ADD CONSTRAINT "expense_metrics_branch_id_fkey"
             FOREIGN KEY ("branch_id")
             REFERENCES ${q}."branches" ("id")
             ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$`,
  ];
}

async function applyToSchema(schema: string): Promise<void> {
  console.log(`\nApplying to ${schema}...`);
  const stmts = statementsFor(schema);
  for (let i = 0; i < stmts.length; i++) {
    await prisma.$executeRawUnsafe(stmts[i]);
  }
  console.log(`  ✓ ${schema} done (${stmts.length} statements)`);
}

async function main(): Promise<void> {
  const schemas = await prisma.$queryRawUnsafe<{ schema_name: string }[]>(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name = 'studio_template' OR schema_name LIKE 'studio_%'
     ORDER BY schema_name`,
  );
  console.log(`Found ${schemas.length} schemas to update:`);
  schemas.forEach((s) => console.log(`  - ${s.schema_name}`));

  for (const { schema_name } of schemas) {
    try {
      await applyToSchema(schema_name);
    } catch (err) {
      console.error(`  ✗ ${schema_name} failed:`, (err as Error).message);
      throw err;
    }
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO "_prisma_migrations"
      (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
    SELECT gen_random_uuid()::text, 'manual-apply-expense-event-system',
           '20260415_expense_event_system', now(), now(), 1
    WHERE NOT EXISTS (
      SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '20260415_expense_event_system'
    )
  `);

  console.log('\n✅ All schemas updated and migration marked applied.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
