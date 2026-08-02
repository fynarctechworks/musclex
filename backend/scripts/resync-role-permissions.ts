/**
 * Resync RBAC role-permissions for EVERY existing studio.
 *
 * Why: `RbacSeedService.seedStudioRoles()` only runs at studio onboarding, so
 * permission codes added to ENTERPRISE_ROLES later (e.g. `analytics.view`)
 * never reach studios that onboarded before the change. `resolvePermissions()`
 * reads RolePermission rows first and only falls back to ENTERPRISE_ROLES when
 * a role has ZERO rows — so existing studios stay stale until resynced.
 *
 * What it does (idempotent, additive only — never removes grants):
 *   1. seedPermissions()  — upserts any new Permission definitions (public schema)
 *   2. forEachTenant(seedStudioRoles) — adds missing RolePermission rows per studio
 *
 * Staff pick up the new permissions on their next token refresh (jwt-auth.guard
 * re-resolves); no logout is required.
 *
 * Usage (from backend/):
 *   npm run build
 *   npx ts-node scripts/resync-role-permissions.ts
 */
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';

async function main() {
  const { AppModule } = require('../dist/app.module');
  const { RbacSeedService } = require('../dist/auth/rbac-seed.service');
  const { TenantTaskRunner } = require('../dist/prisma/tenant-task-runner');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const rbacSeed = app.get(RbacSeedService);
    const taskRunner = app.get(TenantTaskRunner);

    console.log('1/2 Seeding global permission definitions (public schema)…');
    await rbacSeed.seedPermissions();

    console.log('2/2 Resyncing role_permissions for every studio…');
    const summary = await taskRunner.forEachTenant(
      async ({ gymId, schemaName }: { gymId: string; schemaName: string }) => {
        await rbacSeed.seedStudioRoles();
        console.log(`  ✓ ${schemaName} (gym ${gymId})`);
      },
    );

    console.log(
      `Done: ${summary.ok}/${summary.total} studios resynced` +
        (summary.failed ? `, ${summary.failed} FAILED (see warnings above)` : ''),
    );
    process.exitCode = summary.failed > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('resync-role-permissions failed:', e);
  process.exit(1);
});
