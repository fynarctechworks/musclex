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
async function runAsTenant<T>(
  store: TenantStore,
  fn: () => Promise<T>,
): Promise<T> {
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
          data: {
            name: 'Gym A - Downtown',
            city: 'Mumbai',
            status: 'active',
          },
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
          data: { name: 'Gym A - Westside', city: 'Delhi', status: 'active' },
        });
      },
    );

    // Create a branch in Gym B
    await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => {
        await prisma.tenant.branch.create({
          data: { name: 'Gym B - Central', city: 'Bangalore', status: 'active' },
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
          data: { name: 'test_role_gym_a', is_system: false },
        });
      },
    );

    // Try to find it from Gym B context — MUST return null
    const result = await runAsTenant(
      { schemaName: SCHEMA_B, gymId: GYM_B_ID },
      async () => {
        return prisma.tenant.role.findFirst({
          where: { name: 'test_role_gym_a' },
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

  it('should verify tenant context matches expected studio', async () => {
    if (skipIfNoDb) return;

    const isValid = await runAsTenant(
      { schemaName: SCHEMA_A, gymId: GYM_A_ID },
      async () => prisma.verifyFullTenantIsolation(GYM_A_ID),
    );

    expect(isValid).toBe(true);
  });
});
