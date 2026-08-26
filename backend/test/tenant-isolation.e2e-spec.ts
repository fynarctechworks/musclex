/**
 * ============================================================================
 * TENANT ISOLATION — End-to-End Integration Test
 * ============================================================================
 *
 * This test MUST pass before any release. It validates that:
 *   1. Data created in Gym A is NEVER visible to Gym B
 *   2. gym_id is automatically injected on creates
 *   3. gym_id is automatically filtered on reads
 *   4. Cross-tenant writes are blocked
 *   5. RLS blocks raw-query leaks (when enabled)
 *
 * Run: npx jest test/tenant-isolation.e2e-spec.ts --forceExit
 * ============================================================================
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { tenantContext, TenantStore } from '../src/common/tenant-context';

// UUIDs for two separate gyms
const GYM_A_ID = '11111111-1111-1111-1111-111111111111';
const GYM_B_ID = '22222222-2222-2222-2222-222222222222';
const SCHEMA_A = 'studio_11111111_1111_1111_1111_111111111111';
const SCHEMA_B = 'studio_22222222_2222_2222_2222_222222222222';

/**
 * Helper: Run a callback within a specific tenant context
 */
/**
 * The identity a test runs as. Callers supply only schema + gym, which is what
 * these tests are about; the branch-scope fields are filled in below.
 */
type TenantIdentity = Pick<TenantStore, 'schemaName' | 'gymId'>;

/**
 * Branch scope is NOT what these tests exercise, so every run is gym-wide:
 * `allowedBranchIds: 'ALL'` and no bypass. Pinning it here keeps the suite
 * honest — a test that accidentally passed because its branch filter excluded
 * the other gym's rows would prove nothing about TENANT isolation.
 *
 * These three fields were added to TenantStore after this suite was written,
 * and because `.e2e-spec.ts` is not collected by the default `npm test`, the
 * resulting compile error went unnoticed: the file says "MUST pass before any
 * release" while not compiling at all.
 */
function fullScope(identity: TenantIdentity): TenantStore {
  return {
    ...identity,
    activeBranchId: null,
    allowedBranchIds: 'ALL',
    bypassBranchScope: false,
  };
}

/**
 * These tests create rows WITHOUT `gym_id` on purpose — the whole claim under
 * test is that the tenant middleware injects it. Prisma's generated types
 * require the column, so the payload is cast.
 *
 * The cast is narrow and named rather than an inline `as any`, so it cannot be
 * mistaken for a workaround: omitting gym_id IS the assertion.
 */
function omitsGymId<T extends object>(data: T): never {
  return data as never;
}

/**
 * A suffix unique to this run.
 *
 * These tests create rows with fixed names and never clean them up, so a
 * second run died on `Unique constraint failed on (name)` — an isolation test
 * failing for a reason with nothing to do with isolation, which is the most
 * misleading kind of red there is.
 */
const RUN = `${Date.now().toString(36)}`;

async function runAsTenant<T>(
  identity: TenantIdentity,
  fn: () => Promise<T>,
): Promise<T> {
  const store = fullScope(identity);
  return new Promise((resolve, reject) => {
    tenantContext.run(store, async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}

describe('Tenant Isolation (E2E)', () => {
  let prisma: PrismaService;
  let moduleRef: TestingModule;

  // Skip if no DATABASE_URL configured (CI without DB)
  const skipIfNoDb = !process.env.DATABASE_URL;

  beforeAll(async () => {
    if (skipIfNoDb) return;

    moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    // Create test schemas if they don't exist
    for (const schema of [SCHEMA_A, SCHEMA_B]) {
      try {
        await prisma.$executeRawUnsafe(
          `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
        );
        // Clone tables from studio_template
        const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'studio_template'`,
        );
        for (const { tablename } of tables) {
          await prisma.$executeRawUnsafe(
            `CREATE TABLE IF NOT EXISTS "${schema}"."${tablename}" (LIKE studio_template."${tablename}" INCLUDING ALL)`,
          );
        }
      } catch (e) {
        console.warn(`Schema setup warning: ${e.message}`);
      }
    }
  });

  afterAll(async () => {
    if (skipIfNoDb) return;

    // Cleanup test schemas
    for (const schema of [SCHEMA_A, SCHEMA_B]) {
      try {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } catch {
        // ignore
      }
    }
    await prisma.$disconnect();
  });

  // ── TEST 1: gym_id auto-injection on CREATE ──

  it('should auto-inject gym_id when creating a record in Gym A context', async () => {
    if (skipIfNoDb) return;

    const branch = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => {
        return prisma.tenant.branch.create({
          data: omitsGymId({
            name: 'Gym A - Downtown',
            city: 'Mumbai',
            status: 'active',
          }),
        });
      },
    );

    expect(branch).toBeDefined();
    expect((branch as any).gym_id).toBe(GYM_A_ID);
  });

  // ── TEST 2: gym_id auto-filtering on READ ──

  it('should only return records matching the current gym_id context', async () => {
    if (skipIfNoDb) return;

    // Create a branch in Gym A
    await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => {
        await prisma.tenant.branch.create({
          data: omitsGymId({ name: 'Gym A - Westside', city: 'Delhi', status: 'active' }),
        });
      },
    );

    // Create a branch in Gym B
    await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => {
        await prisma.tenant.branch.create({
          data: omitsGymId({ name: 'Gym B - Central', city: 'Bangalore', status: 'active' }),
        });
      },
    );

    // Query from Gym A context — should NOT see Gym B's branch
    const gymABranches = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => {
        return prisma.tenant.branch.findMany();
      },
    );

    const gymBBranches = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => {
        return prisma.tenant.branch.findMany();
      },
    );

    // Gym A should only see its own branches
    for (const branch of gymABranches) {
      expect((branch as any).gym_id).toBe(GYM_A_ID);
    }
    expect(gymABranches.some((b) => b.name.includes('Gym B'))).toBe(false);

    // Gym B should only see its own branches
    for (const branch of gymBBranches) {
      expect((branch as any).gym_id).toBe(GYM_B_ID);
    }
    expect(gymBBranches.some((b) => b.name.includes('Gym A'))).toBe(false);
  });

  // ── TEST 3: findFirst is scoped ──

  it('should NOT find Gym A records when querying from Gym B context', async () => {
    if (skipIfNoDb) return;

    // Create a record in Gym A
    await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => {
        await prisma.tenant.role.create({
          data: omitsGymId({ name: `test_role_gym_a_${RUN}`, is_system: false }),
        });
      },
    );

    // Try to find it from Gym B context — MUST return null
    const result = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => {
        return prisma.tenant.role.findFirst({
          where: { name: `test_role_gym_a_${RUN}` },
        });
      },
    );

    expect(result).toBeNull();
  });

  // ── TEST 4: count is scoped ──

  it('should return correct count per tenant', async () => {
    if (skipIfNoDb) return;

    const countA = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => prisma.tenant.branch.count(),
    );

    const countB = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.tenant.branch.count(),
    );

    // Both should be >= 1 from earlier tests but counts should be independent
    expect(countA).toBeGreaterThanOrEqual(1);
    expect(countB).toBeGreaterThanOrEqual(1);
  });

  // ── TEST 5: updateMany is scoped ──

  it('should only update records within the current tenant', async () => {
    if (skipIfNoDb) return;

    // Update all branches in Gym A
    await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => {
        await prisma.tenant.branch.updateMany({
          where: {},
          data: { state: 'test_state_a' },
        });
      },
    );

    // Verify Gym B branches are NOT affected
    const gymBBranches = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.tenant.branch.findMany(),
    );

    for (const branch of gymBBranches) {
      expect(branch.state).not.toBe('test_state_a');
    }
  });

  // ── TEST 6: deleteMany is scoped ──

  it('should only delete records within the current tenant', async () => {
    if (skipIfNoDb) return;

    // Count Gym B branches before
    const beforeCount = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.tenant.branch.count(),
    );

    // Delete all branches from Gym A context
    await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => {
        await prisma.tenant.branch.deleteMany({});
      },
    );

    // Gym B branches should be unaffected
    const afterCount = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.tenant.branch.count(),
    );

    expect(afterCount).toBe(beforeCount);
  });

  // ── TEST 7: Verify full tenant isolation check ──

  /*
   * `verifyFullTenantIsolation` was rewritten (F-6) to check the tenant
   * CONTEXT the Prisma extension actually reads, instead of `search_path`,
   * which is inert under multiSchema and made this return false in normal
   * operation. So the test is live again.
   */
  it('confirms the request is scoped to the expected studio', async () => {
    if (skipIfNoDb) return;

    const isValid = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => prisma.verifyFullTenantIsolation(GYM_A_ID),
    );

    expect(isValid).toBe(true);
  });

  it('rejects a context belonging to a DIFFERENT studio', async () => {
    if (skipIfNoDb) return;

    // The failure this exists to catch: running as gym B while believing the
    // request is gym A's.
    const isValid = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => prisma.verifyFullTenantIsolation(GYM_A_ID),
    );

    expect(isValid).toBe(false);
  });

  it('rejects a request with no tenant context at all', async () => {
    if (skipIfNoDb) return;

    // Outside runAsTenant there is no store — which must fail closed, not pass.
    expect(prisma.verifyFullTenantIsolation(GYM_A_ID)).toBe(false);
  });
});
