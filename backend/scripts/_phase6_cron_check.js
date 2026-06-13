// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 CRON CHECK — proves the forEachTenant sweep is per-gym isolated.
// Branch DB only. Mirrors TenantTaskRunner.forEachTenant: list studios from the
// registry, bind a tenant client to each gym's schema (from the registry, NOT
// derived from gym_id), run the job body, assert it only touches that gym.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient: PublicClient } = require('e:/Projects/musclex/backend/node_modules/.prisma/client-public');
const { PrismaClient: TenantClient } = require('e:/Projects/musclex/backend/node_modules/.prisma/client-tenant');
const assert = require('assert');

const BASE = 'postgresql://postgres:branchpass@localhost:5433/postgres';
const SCHEMA_RE = /^studio_[0-9a-f_]+$/i;

async function forEachTenant(pub, fn) {
  const studios = await pub.studio.findMany({ select: { id: true, schema_name: true } });
  let ok = 0;
  for (const s of studios) {
    if (!SCHEMA_RE.test(s.schema_name)) continue;
    const client = new TenantClient({ datasources: { db: { url: `${BASE}?schema=${s.schema_name}` } } });
    try {
      await fn({ gymId: s.id, schemaName: s.schema_name, client });
      ok++;
    } finally {
      await client.$disconnect();
    }
  }
  return { total: studios.length, ok };
}

async function main() {
  const pub = new PublicClient({ datasources: { db: { url: BASE } } });

  // A cron-like body: read this gym's members + memberships, assert every row is
  // this gym's. A leak (seeing another gym's row) fails the sweep.
  const seen = [];
  const summary = await forEachTenant(pub, async ({ gymId, client }) => {
    const members = await client.member.findMany();
    const memberships = await client.memberMembership.findMany();
    assert(members.every((m) => m.gym_id === gymId), `CRON LEAK: gym ${gymId} saw a foreign member`);
    assert(memberships.every((m) => m.gym_id === gymId), `CRON LEAK: gym ${gymId} saw a foreign membership`);
    seen.push({ gymId, members: members.length });
  });

  // Both test gyms must have been swept, each seeing only its own member.
  assert(summary.ok >= 2, `expected >=2 gyms swept, got ${summary.ok}`);
  const a = seen.find((x) => x.gymId === '11111111-1111-1111-1111-111111111111');
  const b = seen.find((x) => x.gymId === '22222222-2222-2222-2222-222222222222');
  assert(a && a.members === 1, 'Gym A cron body must see exactly its 1 member');
  assert(b && b.members === 1, 'Gym B cron body must see exactly its 1 member');

  console.log(`✓ forEachTenant swept ${summary.ok}/${summary.total} gyms; each cron body isolated to its own schema`);
  console.log(`  Gym A saw ${a.members} member, Gym B saw ${b.members} member — 0 cross-gym leak`);
  console.log('\nPHASE-6 CRON CHECK PASSED');
  await pub.$disconnect();
}
main().catch((e) => { console.error('✗ FAIL:', e.message); process.exit(1); });
