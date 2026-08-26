import { readFileSync } from 'fs';
import { join } from 'path';

import { Prisma } from '@prisma/client';
import { TENANT_MODELS } from './tenant-models';

/**
 * Tenant-isolation drift guard.
 *
 * The load-bearing isolation layer is the `$use` middleware in prisma.service.ts,
 * which scopes a query ONLY if its model is in TENANT_MODELS. If a new Prisma model
 * with a `gym_id` column is added but NOT registered here, every query against it
 * runs UNSCOPED → cross-tenant leak. This is exactly how prior leaks happened
 * (see project_biometric_tenant_leak).
 *
 * This test reads the Prisma DMMF (static, no DB needed) and asserts the registry
 * and the schema can never drift apart. The DB-side RLS coverage is kept in sync
 * separately by the data-driven migration 20260603_rls_coverage_data_driven, which
 * enables RLS on every gym_id table automatically.
 */
describe('TENANT_MODELS drift guard', () => {
  const modelsWithGymId = Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'gym_id'))
    .map((m) => m.name)
    .sort();

  const allModelNames = new Set(Prisma.dmmf.datamodel.models.map((m) => m.name));

  // Known, intentional deferrals (D4 fix). Now EMPTY — Group 2 landed: the 3
  // compound-unique upsert models (BiometricEnrollment, StaffBiometricEnrollment,
  // BranchProductPrice) were made explicitly gym-scoped and registered. Any future
  // gym_id model that needs a temporary deferral can be parked here with a doc ref;
  // an entry that is actually registered or non-existent fails the staleness test below.
  const KNOWN_DEFERRED = new Set<string>([]);

  // PUBLIC-schema routing indexes (NOT tenant tables): they carry a gym_id
  // column as routing DATA, are read/written exclusively through
  // PublicPrismaService, and by design are resolved BEFORE any tenant context
  // exists (device auth, iclock SN routing). Registering them in TENANT_MODELS
  // would be wrong — the $use tenant middleware never sees the public client,
  // and these lookups must work cross-gym pre-context.
  const PUBLIC_REGISTRY_MODELS = new Set<string>([
    'DeviceIndex',
    'BiometricDeviceIndex',
    'WhatsAppNumberIndex',
    /*
     * StaffDeviceToken — staff push tokens.
     *
     * Not a routing index, but public for the same structural reason: the row
     * is keyed by the PERSON, not the gym. One staff phone can hold roles in
     * several studios, and "clear my device on sign out" has to be a single
     * delete that cannot miss one. Its gym_id is the send-target column, and
     * every read in StaffPushService filters on it explicitly (asserted in
     * test/push/staff-push.service.spec.ts) because nothing injects it here.
     */
    'StaffDeviceToken',
  ]);

  it('every Prisma model with a gym_id field is registered in TENANT_MODELS (or explicitly deferred)', () => {
    const missing = modelsWithGymId.filter(
      (name) =>
        !TENANT_MODELS.has(name) &&
        !KNOWN_DEFERRED.has(name) &&
        !PUBLIC_REGISTRY_MODELS.has(name),
    );
    expect(missing).toEqual([]);
    // Sanity: we actually found gym_id models (guards against a broken DMMF import
    // silently passing the test with an empty list).
    expect(modelsWithGymId.length).toBeGreaterThan(50);
  });

  it('the deferred list is not stale — every deferred model is real, gym_id-bearing, and still unregistered', () => {
    const gymIdModelSet = new Set(modelsWithGymId);
    const bogus = [...KNOWN_DEFERRED].filter(
      (name) => !gymIdModelSet.has(name) || TENANT_MODELS.has(name),
    );
    expect(bogus).toEqual([]);
  });

  /*
   * The exemption list is the one place a tenant table could be parked by
   * mistake and leak silently. A comment saying "this one is public" is not
   * enforcement — so read the schema and check.
   */
  it('every exempted model is genuinely declared in the public schema', () => {
    const schema = readFileSync(join(__dirname, '../../prisma/schema.prisma'), 'utf8');
    const notPublic = [...PUBLIC_REGISTRY_MODELS].filter((name) => {
      const block = new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(schema);
      return !block || !/@@schema\("public"\)/.test(block[1]);
    });
    expect(notPublic).toEqual([]);
  });

  it('every name in TENANT_MODELS is a real model that has a gym_id field', () => {
    const gymIdModelSet = new Set(modelsWithGymId);
    const stale = [...TENANT_MODELS].filter((name) => {
      if (!allModelNames.has(name)) return true; // not a real Prisma model
      return !gymIdModelSet.has(name); // real model but no gym_id column
    });
    expect(stale).toEqual([]);
  });
});
