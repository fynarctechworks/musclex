import { PrismaClient } from '@prisma/client';

const STUDIO_ID = process.argv[2] || '17b22e99-dd2a-49f7-8b64-63b3645bf588';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, organization_id, is_active FROM studio_template.branches WHERE gym_id = $1::uuid`,
    STUDIO_ID,
  );
  console.log(`studio_template.branches WHERE gym_id=${STUDIO_ID}:`);
  console.table(rows);

  const plans = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, price, is_active FROM studio_template.membership_plans WHERE gym_id = $1::uuid`,
    STUDIO_ID,
  );
  console.log(`\nstudio_template.membership_plans WHERE gym_id=${STUDIO_ID}:`);
  console.table(plans);

  const orgs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name FROM studio_template.organizations WHERE gym_id = $1::uuid`,
    STUDIO_ID,
  );
  console.log(`\nstudio_template.organizations WHERE gym_id=${STUDIO_ID}:`);
  console.table(orgs);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
