import { PrismaClient } from '@prisma/client';

const SCHEMA = process.argv[2] || 'studio_01b37479_06b4_4844_b138_0fd6a263f067';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  const fks = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tc.constraint_name, tc.table_name, kcu.column_name,
            ccu.table_schema AS foreign_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=$1 AND tc.table_name='members'
     ORDER BY tc.constraint_name`,
    SCHEMA,
  );
  console.log(`FKs on ${SCHEMA}.members:`);
  console.table(fks);

  const dFks = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tc.constraint_name, tc.table_name, kcu.column_name,
            ccu.table_schema AS foreign_schema,
            ccu.table_name AS foreign_table_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=$1 AND tc.table_name='domain_events'
     ORDER BY tc.constraint_name`,
    SCHEMA,
  );
  console.log(`\nFKs on ${SCHEMA}.domain_events:`);
  console.table(dFks);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
