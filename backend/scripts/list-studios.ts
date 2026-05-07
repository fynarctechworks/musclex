import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, owner_user_id, schema_name, account_type, created_at FROM public.studios ORDER BY created_at DESC`,
  );
  console.table(rows);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
