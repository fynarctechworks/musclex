/**
 * Reproduces the actual Prisma calls from MembersService.create inside the
 * tenant context, to expose the true error behind the 500.
 *
 * Usage: npx ts-node scripts/repro-create-member.ts <schema_name> <studio_id> <branch_id>
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID, randomBytes } from 'crypto';

async function main() {
  const schema = process.argv[2];
  const studioId = process.argv[3];
  const branchId = process.argv[4];
  if (!schema || !studioId || !branchId) {
    console.error('Usage: repro-create-member.ts <schema> <studio_id> <branch_id>');
    process.exit(1);
  }

  const prisma = new PrismaClient({ log: ['error', 'warn'] });
  await prisma.$connect();
  await prisma.$executeRawUnsafe(`SET search_path TO "${schema}", public`);
  await prisma.$executeRawUnsafe(`SET app.gym_id = '${studioId}'`);

  const memberCode = `FS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const qrCode = randomUUID();

  console.log(`Creating member in ${schema} (studio_id=${studioId}, branch_id=${branchId})`);

  try {
    // Find organization
    const org = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "${schema}".organizations LIMIT 1`,
    );
    console.log('  organizations:', org);

    // Transaction mirroring MembersService.create
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`);
      await tx.$executeRawUnsafe(`SET LOCAL app.gym_id = '${studioId}'`);

      const memberRow = await tx.$queryRawUnsafe<any[]>(
        `INSERT INTO "${schema}".members
         (gym_id, member_code, organization_id, branch_id, full_name, phone, qr_code, checkin_method, status, referral_code)
         VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10)
         RETURNING id, member_code, full_name, status, branch_id`,
        studioId, memberCode, org[0]?.id, branchId, 'Repro Test', `+9999${Math.floor(Math.random() * 1e6)}`,
        qrCode, 'manual', 'active', randomUUID().slice(0, 8).toUpperCase(),
      );
      console.log('  member inserted:', memberRow);

      const evtRow = await tx.$queryRawUnsafe<any[]>(
        `INSERT INTO "${schema}".domain_events
         (gym_id, aggregate_type, aggregate_id, event_type, payload, branch_id, processed)
         VALUES ($1::uuid, $2, $3::uuid, $4, $5::jsonb, $6::uuid, false)
         RETURNING id, version`,
        studioId, 'member', memberRow[0].id, 'MEMBER_CREATED',
        JSON.stringify({ test: true }), branchId,
      );
      console.log('  event inserted:', evtRow);

      throw new Error('ROLLBACK_FOR_TEST');
    });
    console.log('  ✓ Transaction succeeded:', result);
  } catch (e: any) {
    if (e.message === 'ROLLBACK_FOR_TEST') {
      console.log('  ✓ Full transaction succeeded (rolled back for test)');
    } else {
      console.log(`  ✗ FAILED: ${e.message}`);
      if (e.meta) console.log('  meta:', e.meta);
    }
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
