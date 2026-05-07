import { PrismaClient } from '@prisma/client';

const SCHEMA = 'studio_01b37479_06b4_4844_b138_0fd6a263f067';
const STUDIO_ID = '17b22e99-dd2a-49f7-8b64-63b3645bf588';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  await prisma.$executeRawUnsafe(`SET search_path TO "${SCHEMA}", public`);

  console.log('Testing domain_events table shape...');
  const dCols = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'domain_events'
     ORDER BY ordinal_position`,
    SCHEMA,
  );
  console.table(dCols);

  console.log('\nTesting domain_events insert...');
  try {
    await prisma.$executeRawUnsafe(`BEGIN`);
    await prisma.$executeRawUnsafe(`SET LOCAL search_path TO "${SCHEMA}", public`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${SCHEMA}".domain_events
         (gym_id, aggregate_type, aggregate_id, event_type, payload, processed)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5::jsonb, $6)`,
      STUDIO_ID, 'member', '00000000-0000-0000-0000-000000000001', 'MEMBER_CREATED',
      JSON.stringify({ test: true }), false,
    );
    console.log('   ✓ domain_events insert succeeds');
    await prisma.$executeRawUnsafe(`ROLLBACK`);
  } catch (e: any) {
    console.log(`   ✗ FAILED: ${e.message}`);
    await prisma.$executeRawUnsafe(`ROLLBACK`).catch(() => {});
  }

  // Check all DEFAULT NOT NULL columns without defaults — these could cause Prisma create errors
  console.log('\nRequired columns without defaults in members table:');
  const requiredCols = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'members'
       AND is_nullable = 'NO' AND column_default IS NULL
     ORDER BY ordinal_position`,
    SCHEMA,
  );
  console.table(requiredCols);

  console.log('\nRequired columns without defaults in domain_events table:');
  const reqDom = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'domain_events'
       AND is_nullable = 'NO' AND column_default IS NULL
     ORDER BY ordinal_position`,
    SCHEMA,
  );
  console.table(reqDom);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
