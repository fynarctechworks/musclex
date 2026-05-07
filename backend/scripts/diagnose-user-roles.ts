import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const shivaGymId = 'c24e2137-b6f6-4762-8a15-baf4fac423da';

  console.log('\n=== user_roles for shiva gym ===');
  const userRoles = await prisma.$queryRawUnsafe<
    Array<{ user_id: string; studio_id: string; role_name: string; branch_id: string | null; is_primary: boolean }>
  >(
    `SELECT user_id, studio_id, role_name, branch_id, is_primary
     FROM public.user_roles
     WHERE studio_id = $1::uuid`,
    shivaGymId,
  );
  console.table(userRoles);

  console.log('\n=== Supabase user_metadata for users in shiva gym ===');
  if (userRoles.length > 0) {
    const uid = userRoles[0].user_id;
    const ui = await prisma.$queryRawUnsafe<
      Array<{ id: string; email: string | null }>
    >(
      `SELECT id, email FROM public.user_identities WHERE id = $1::uuid`,
      uid,
    );
    console.table(ui);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
