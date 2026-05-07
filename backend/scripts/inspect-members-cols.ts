import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  await p.$connect();
  const cols = await p.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'studio_01b37479_06b4_4844_b138_0fd6a263f067'
       AND table_name = 'members' ORDER BY ordinal_position`,
  );
  console.log(`\n=== members table: ${cols.length} columns ===`);
  console.table(cols);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
