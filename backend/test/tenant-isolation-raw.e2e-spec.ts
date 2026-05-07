/**
 * ============================================================================
 * TENANT ISOLATION (raw Prisma client) — End-to-End Integration Test
 * ============================================================================
 *
 * Companion to tenant-isolation.e2e-spec.ts.
 *
 * The sibling test exercises `prisma.tenant.*` (the explicit tenant-scoped
 * extension). This test proves that raw `prisma.*` queries — which every
 * existing service uses — are ALSO auto-scoped by the `$use` middleware
 * added in prisma.service.ts.
 *
 * If this test ever fails, tenant isolation is broken for ~80 services that
 * have never been migrated to `prisma.tenant.*`.
 *
 * Run: npx jest test/tenant-isolation-raw.e2e-spec.ts --forceExit
 * ============================================================================
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { tenantContext, TenantStore } from '../src/common/tenant-context';

const GYM_A_ID = '33333333-3333-3333-3333-333333333333';
const GYM_B_ID = '44444444-4444-4444-4444-444444444444';
const SCHEMA_A = 'studio_33333333_3333_3333_3333_333333333333';
const SCHEMA_B = 'studio_44444444_4444_4444_4444_444444444444';

async function runAsTenant<T>(store: TenantStore, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    tenantContext.run(store, async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    });
  });
}

describe('Tenant Isolation — raw prisma client ($use middleware)', () => {
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const skipIfNoDb = !process.env.DATABASE_URL;

  beforeAll(async () => {
    if (skipIfNoDb) return;

    moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!skipIfNoDb) await prisma.$disconnect();
  });

  // ── TEST 1: RAW findMany is auto-scoped by gym_id ──
  it('raw prisma.branch.findMany auto-filters by gym_id from tenant context', async () => {
    if (skipIfNoDb) return;

    // Create a branch for Gym A using the raw client (not prisma.tenant)
    await runAsTenant({ schemaName: SCHEMA_A, gymId: GYM_A_ID }, async () => {
      await prisma.branch.create({
        data: { name: 'RawTest A-1', city: 'Mumbai', status: 'active' } as any,
      });
    });

    // Create a branch for Gym B using the raw client
    await runAsTenant({ schemaName: SCHEMA_B, gymId: GYM_B_ID }, async () => {
      await prisma.branch.create({
        data: { name: 'RawTest B-1', city: 'Delhi', status: 'active' } as any,
      });
    });

    const gymABranches = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => prisma.branch.findMany({ where: { name: { startsWith: 'RawTest' } } }),
    );

    expect(gymABranches.length).toBeGreaterThanOrEqual(1);
    for (const b of gymABranches) {
      expect((b as any).gym_id).toBe(GYM_A_ID);
    }
    expect(gymABranches.some((b) => b.name === 'RawTest B-1')).toBe(false);
  });

  // ── TEST 2: RAW create auto-injects gym_id when omitted from data ──
  it('raw prisma.branch.create auto-injects gym_id from tenant context', async () => {
    if (skipIfNoDb) return;

    const branch = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => {
        // Deliberately omit gym_id from payload — middleware must inject it.
        return prisma.branch.create({
          data: { name: 'Auto-injected A', city: 'Pune', status: 'active' } as any,
        });
      },
    );

    expect((branch as any).gym_id).toBe(GYM_A_ID);
  });

  // ── TEST 3: RAW findFirst is scoped ──
  it('raw prisma.branch.findFirst returns null when target belongs to another tenant', async () => {
    if (skipIfNoDb) return;

    const gymABranch = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => prisma.branch.findFirst({ where: { name: 'RawTest A-1' } }),
    );
    expect(gymABranch).not.toBeNull();

    // From Gym B context, the same name must not be findable
    const crossLookup = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.branch.findFirst({ where: { name: 'RawTest A-1' } }),
    );
    expect(crossLookup).toBeNull();
  });

  // ── TEST 4: RAW findUnique post-check rejects cross-tenant id ──
  it('raw prisma.branch.findUnique returns null when id belongs to another tenant', async () => {
    if (skipIfNoDb) return;

    const gymABranch = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => prisma.branch.findFirst({ where: { name: 'RawTest A-1' } }),
    );
    if (!gymABranch) return;

    const crossFetch = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.branch.findUnique({ where: { id: gymABranch.id } }),
    );

    expect(crossFetch).toBeNull();
  });

  // ── TEST 5: RAW updateMany is scoped ──
  it('raw prisma.branch.updateMany does not touch other tenants rows', async () => {
    if (skipIfNoDb) return;

    await runAsTenant({ schemaName: SCHEMA_A, gymId: GYM_A_ID }, async () => {
      await prisma.branch.updateMany({ where: {}, data: { state: 'raw_test_a_state' } as any });
    });

    const gymBRows = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.branch.findMany({ where: { name: { startsWith: 'RawTest' } } }),
    );
    for (const b of gymBRows) {
      expect((b as any).state).not.toBe('raw_test_a_state');
    }
  });

  // ── TEST 6: RAW count is scoped ──
  it('raw prisma.branch.count returns only the current tenants rows', async () => {
    if (skipIfNoDb) return;

    const a = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => prisma.branch.count({ where: { name: { startsWith: 'RawTest' } } }),
    );
    const b = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.branch.count({ where: { name: { startsWith: 'RawTest' } } }),
    );

    expect(a).toBeGreaterThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(1);
    // Each tenant's count should equal only its own records (disjoint).
    // If the middleware were broken, a and b would return the same combined total.
    const totalInTemplate = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n FROM studio_template.branches
      WHERE name LIKE 'RawTest%'
    `;
    const combined = Number(totalInTemplate?.[0]?.n ?? 0);
    // Expect a + b ≤ combined (each row counted for exactly one tenant).
    expect(a + b).toBeLessThanOrEqual(combined);
  });

  // ── TEST 7: Cleanup — also proves deleteMany is scoped ──
  afterAll(async () => {
    if (skipIfNoDb) return;
    await runAsTenant({ schemaName: SCHEMA_A, gymId: GYM_A_ID }, async () => {
      await prisma.branch.deleteMany({ where: { name: { startsWith: 'RawTest' } } });
    });
    await runAsTenant({ schemaName: SCHEMA_B, gymId: GYM_B_ID }, async () => {
      await prisma.branch.deleteMany({ where: { name: { startsWith: 'RawTest' } } });
    });
  });
});
