import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const studios = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, slug, schema_name, owner_user_id, created_at
     FROM public.studios
     ORDER BY created_at DESC
     LIMIT 10`,
  );
  console.log('\n=== Studios in public.studios ===');
  console.table(studios);

  // Also list actual schemas that exist
  const schemas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name LIKE 'studio_%' ORDER BY schema_name`,
  );
  console.log('\n=== Actual studio_* schemas in database ===');
  console.table(schemas);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
