/**
 * SHARED TEST HARNESS — per-gym cron tenant isolation (feat/per-gym-schemas)
 *
 * Background crons have no HTTP request, so they iterate gyms via
 * `TenantTaskRunner.forEachTenant`, which lists every registered studio from the
 * REGISTRY and runs the job body inside that studio's tenant context (schema from
 * `studios.schema_name`). Inside the body, `this.tenant.client.*` is bound to
 * that one gym's physical schema.
 *
 * These helpers reproduce that wiring in unit tests:
 *  - `makeTaskRunner(gymIds)` builds a REAL `TenantTaskRunner` over a mocked
 *    registry, so `forEachTenant` genuinely sets the ALS context per gym.
 *  - `makeTenantAccessor(clientByGym)` is a `TenantPrisma`-shaped accessor whose
 *    `.client` resolves to the per-gym mock for the CURRENT ambient gym — this is
 *    what makes "each gym sees only its own rows" hold, mirroring schema isolation.
 */

import { TenantTaskRunner } from '../../src/prisma/tenant-task-runner';
import { getTenantGymId } from '../../src/common/tenant-context';

/** Registry schema_name for a gym id (matches the runner's TENANT_SCHEMA_RE). */
export function schemaFor(gymId: string): string {
  return `studio_${gymId.replace(/-/g, '_')}`;
}

/** A real TenantTaskRunner backed by a mocked registry of the given gyms. */
export function makeTaskRunner(gymIds: string[]): TenantTaskRunner {
  const studios = gymIds.map((id) => ({ id, schema_name: schemaFor(id) }));
  const pub: any = {
    studio: {
      findMany: jest.fn().mockResolvedValue(studios),
      findUnique: jest.fn(async ({ where }: any) =>
        studios.find((s) => s.id === where.id) ?? null,
      ),
    },
  };
  return new TenantTaskRunner(pub);
}

/**
 * TenantPrisma-shaped accessor: `.client` returns the per-gym mock for whatever
 * gym is currently in ambient context (set by forEachTenant). Throws if accessed
 * outside any tenant context — the same fail-closed posture as the real accessor.
 */
export function makeTenantAccessor(clientByGym: Record<string, any>): any {
  return {
    get client() {
      const gymId = getTenantGymId();
      const c = gymId ? clientByGym[gymId] : undefined;
      if (!c) {
        throw new Error(
          `tenant client accessed without a known gym (gymId=${String(gymId)})`,
        );
      }
      return c;
    },
  };
}
