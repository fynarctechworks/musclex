// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 ISOLATION CHECK — reusable per-domain verifier. Branch DB only.
// ─────────────────────────────────────────────────────────────────────────────
// Run after each Phase-6 rewiring slice. Proves the routing contract the rewired
// services depend on end-to-end:
//
//   gym_id  --(registry lookup, exactly as TenantMiddleware)-->  schema_name
//           --(TenantClientFactory URL convention)-->  per-gym client
//           --(query)-->  ONLY that gym's rows
//
// It deliberately resolves schema_name from public.studios (NOT studio_<gym_id>),
// so a regression that derives the schema from gym_id would fail here.
//
// Extend PROBES as each domain seeds more tables. Requires _phase6_setup_test_gyms.sh
// to have run first (two test gyms: Gym A / Gym B).
const { PrismaClient: PublicClient } = require('e:/Projects/musclex/backend/node_modules/.prisma/client-public');
const { PrismaClient: TenantClient } = require('e:/Projects/musclex/backend/node_modules/.prisma/client-tenant');
const assert = require('assert');

const BASE = 'postgresql://postgres:branchpass@localhost:5433/postgres';
const STRICT_SCHEMA_RE = /^studio_[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}$/i;

const GYM_A = '11111111-1111-1111-1111-111111111111';
const GYM_B = '22222222-2222-2222-2222-222222222222';

// Tables to probe. delegate = Prisma model accessor; each seeded gym has exactly
// `expect` rows, all carrying its own gym_id. Add a line per domain as it is
// rewired + seeded (e.g. memberships, classes, inventory_items).
const PROBES = [
  { delegate: 'member', expect: 1 },
  { delegate: 'branch', expect: 1 },
  { delegate: 'staff', expect: 1 }, // settings domain (Phase 6.2)
];

const tenantCache = new Map();
function tenantFor(schema) {
  assert(STRICT_SCHEMA_RE.test(schema), `schema_name failed strict regex: ${schema}`);
  if (!tenantCache.has(schema)) {
    tenantCache.set(schema, new TenantClient({ datasources: { db: { url: `${BASE}?schema=${schema}` } } }));
  }
  return tenantCache.get(schema);
}

async function main() {
  const pub = new PublicClient({ datasources: { db: { url: BASE } } });
  let pass = 0;

  // 1. Registry lookup resolves a per-gym schema that is NOT studio_<gym_id>.
  const studioA = await pub.studio.findUnique({ where: { id: GYM_A } });
  const studioB = await pub.studio.findUnique({ where: { id: GYM_B } });
  assert(studioA && studioB, 'both test gyms must be registered (run _phase6_setup_test_gyms.sh)');
  assert(studioA.schema_name !== `studio_${GYM_A.replace(/-/g, '_')}`, 'schema_name must differ from studio_<gym_id>');
  console.log(`✓ registry: Gym A -> ${studioA.schema_name}, Gym B -> ${studioB.schema_name} (both != studio_<gym_id>)`);
  pass++;

  const ta = tenantFor(studioA.schema_name);
  const tb = tenantFor(studioB.schema_name);

  // 2. Each probed table is isolated: gym A's client sees only gym A rows, etc.
  for (const { delegate, expect } of PROBES) {
    const aRows = await ta[delegate].findMany();
    const bRows = await tb[delegate].findMany();
    assert(aRows.length === expect, `${delegate}: Gym A expected ${expect} rows, got ${aRows.length}`);
    assert(bRows.length === expect, `${delegate}: Gym B expected ${expect} rows, got ${bRows.length}`);
    assert(aRows.every((r) => r.gym_id === GYM_A), `${delegate}: Gym A client returned a non-A row (LEAK)`);
    assert(bRows.every((r) => r.gym_id === GYM_B), `${delegate}: Gym B client returned a non-B row (LEAK)`);
    console.log(`✓ ${delegate}: A sees ${aRows.length} (all gym A), B sees ${bRows.length} (all gym B) — isolated`);
    pass++;
  }

  // 3. Cross-leak: gym A's client can never see a row tagged with gym B's id.
  for (const { delegate } of PROBES) {
    const bleed = await ta[delegate].findMany({ where: { gym_id: GYM_B } });
    assert(bleed.length === 0, `${delegate}: Gym A client returned ${bleed.length} gym-B rows (LEAK)`);
  }
  console.log('✓ cross-leak: Gym A client returns 0 rows for gym_id=B across all probes');
  pass++;

  console.log(`\nALL ${pass} PHASE-6 ISOLATION CHECKS PASSED (${PROBES.length} tables probed)`);
  await pub.$disconnect();
  for (const c of tenantCache.values()) await c.$disconnect();
}
main().catch((e) => { console.error('✗ FAIL:', e.message); process.exit(1); });
