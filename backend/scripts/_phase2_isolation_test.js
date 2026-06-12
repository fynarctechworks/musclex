// Proves the per-schema cached tenant-client factory cannot leak across gyms.
// Branch DB only. Temp.
const { PrismaClient: TenantClient } = require('e:/Projects/musclex/backend/node_modules/.prisma/client-tenant');
const assert = require('assert');

const BASE = 'postgresql://postgres:branchpass@localhost:5433/postgres';
const SCHEMA_RE = /^studio_[0-9a-f_]+$/i;
const cache = new Map();

function clientForSchema(schema) {
  if (!SCHEMA_RE.test(schema)) throw new Error(`invalid tenant schema: ${schema}`);
  if (!cache.has(schema)) {
    cache.set(schema, new TenantClient({ datasources: { db: { url: `${BASE}?schema=${schema}` } } }));
  }
  return cache.get(schema);
}

const A = 'studio_aaaaaaaaaaaa', B = 'studio_bbbbbbbbbbbb';
const GYM_A = '11111111-1111-1111-1111-111111111111';
const GYM_B = '22222222-2222-2222-2222-222222222222';

async function main() {
  let pass = 0;

  // 1. Basic isolation
  const a = clientForSchema(A), b = clientForSchema(B);
  const aRows = await a.member.findMany();
  const bRows = await b.member.findMany();
  assert(aRows.length === 1 && aRows[0].gym_id === GYM_A, 'A must see only gym A');
  assert(bRows.length === 1 && bRows[0].gym_id === GYM_B, 'B must see only gym B');
  console.log('✓ test 1: basic isolation (A→Alice, B→Bob)'); pass++;

  // 2. Cache identity (no per-request client churn)
  assert(clientForSchema(A) === a && clientForSchema(B) === b, 'cache must return same instance');
  console.log('✓ test 2: per-schema client is cached (1 client per gym)'); pass++;

  // 3. Concurrent interleaved load — the real leak test
  const tasks = [];
  for (let i = 0; i < 100; i++) {
    const isA = i % 2 === 0;
    const c = clientForSchema(isA ? A : B);
    const want = isA ? GYM_A : GYM_B;
    tasks.push(c.member.findMany().then((rows) => {
      assert(rows.length === 1 && rows[0].gym_id === want, `leak! iter ${i} expected ${want} got ${rows[0]?.gym_id}`);
    }));
  }
  await Promise.all(tasks);
  console.log('✓ test 3: 100 concurrent interleaved queries — zero cross-gym leak'); pass++;

  // 4. Injection guard
  for (const bad of ['studio_x; DROP TABLE members', 'public', 'studio_a" UNION', '../etc']) {
    let threw = false;
    try { clientForSchema(bad); } catch { threw = true; }
    assert(threw, `guard must reject: ${bad}`);
  }
  console.log('✓ test 4: injection guard rejects non studio_<hex> names'); pass++;

  console.log(`\nALL ${pass}/4 ISOLATION TESTS PASSED`);
  for (const c of cache.values()) await c.$disconnect();
}
main().catch((e) => { console.error('✗ FAIL:', e.message); process.exit(1); });
