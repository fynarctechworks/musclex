import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const tpl = await prisma.$queryRawUnsafe<any[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'studio_template' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  console.log(`studio_template has ${tpl.length} tables`);
  tpl.slice(0, 10).forEach((t: any) => console.log('  -', t.table_name));

  const target = 'studio_637ba494_a33e_4148_8c12_47f2c79fd839';
  const tgt = await prisma.$queryRawUnsafe<any[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    target,
  );
  console.log(`\n${target} has ${tgt.length} tables`);

  const all = await prisma.$queryRawUnsafe<any[]>(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'studio\\_%' ESCAPE '\\' ORDER BY schema_name`,
  );
  console.log(`\nAll studio_ schemas (${all.length}):`);
  all.forEach((s: any) => console.log('  -', s.schema_name));

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
