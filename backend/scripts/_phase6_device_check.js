// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 DEVICE-INDEX CHECK — proves device-token -> tenant routing. Branch only.
// Mirrors DevicesService.verifySecret: resolve gym+schema from public.device_index
// (no gym context), build a client for that schema, read the per-gym device row.
// Requires the seed below (a Gym A device + its index row) — idempotent insert.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient: Pub } = require('e:/Projects/musclex/backend/node_modules/.prisma/client-public');
const { PrismaClient: Tenant } = require('e:/Projects/musclex/backend/node_modules/.prisma/client-tenant');
const assert = require('assert');

const BASE = 'postgresql://postgres:branchpass@localhost:5433/postgres';
const A_SCHEMA = 'studio_aaaaaaaa_aaaa_aaaa_aaaa_aaaaaaaaaaaa';
const A_GYM = '11111111-1111-1111-1111-111111111111';
const A_BRANCH = '1b111111-1111-1111-1111-111111111111';
const DEVICE = 'd1111111-1111-1111-1111-111111111111';

async function main() {
  const pub = new Pub({ datasources: { db: { url: BASE } } });

  // Seed (idempotent): per-gym device row + public routing index.
  const seed = new Tenant({ datasources: { db: { url: `${BASE}?schema=${A_SCHEMA}` } } });
  await seed.$executeRawUnsafe(
    `INSERT INTO check_in_devices (id, gym_id, branch_id, device_name, kind, device_secret, pin_hash, status, registered_by)
     VALUES ($1::uuid,$2::uuid,$3::uuid,'Gym A Kiosk','web_kiosk','scrypt$aa$bb','pending:x','active',$2::uuid)
     ON CONFLICT (id) DO NOTHING`,
    DEVICE, A_GYM, A_BRANCH,
  );
  await seed.$disconnect();
  await pub.deviceIndex.upsert({
    where: { device_id: DEVICE },
    create: { device_id: DEVICE, gym_id: A_GYM, schema_name: A_SCHEMA },
    update: { gym_id: A_GYM, schema_name: A_SCHEMA },
  });

  // verifySecret routing: index -> schema -> per-gym device row.
  const idx = await pub.deviceIndex.findUnique({ where: { device_id: DEVICE } });
  assert(idx && idx.schema_name === A_SCHEMA, 'index must resolve the gym schema');
  const client = new Tenant({ datasources: { db: { url: `${BASE}?schema=${idx.schema_name}` } } });
  const row = await client.checkInDevice.findUnique({
    where: { id: DEVICE },
    select: { id: true, gym_id: true, status: true },
  });
  assert(row && row.gym_id === A_GYM && row.status === 'active', 'device row must be gym A & active');

  // Unknown token id must not resolve (fail-closed).
  const missing = await pub.deviceIndex.findUnique({
    where: { device_id: 'd9999999-9999-9999-9999-999999999999' },
  });
  assert(missing === null, 'unknown device id must not resolve a tenant');

  console.log(`✓ device ${DEVICE} -> index ${idx.schema_name} -> gym ${row.gym_id} (active); unknown -> null`);
  console.log('PHASE-6 DEVICE-INDEX CHECK PASSED');
  await pub.$disconnect();
  await client.$disconnect();
}
main().catch((e) => { console.error('✗ FAIL:', e.message); process.exit(1); });
