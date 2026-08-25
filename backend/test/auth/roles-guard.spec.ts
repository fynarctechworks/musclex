import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../../src/common/guards/roles.guard';

/**
 * Regression tests for the owner-tier bypass.
 *
 * `owner` and `brand_owner` are TENANT roles — the top of one gym, not of the
 * platform. They previously satisfied EVERY @Roles(...) check, so a controller
 * declared @Roles('super_admin') still admitted a gym owner (verified live: a
 * gym-owner token returned 200 from /admin/referrals/analytics/funnel).
 *
 * The bypass is deliberately retained for tenant-scoped routes: dozens of
 * endpoints list `owner` but not `brand_owner`, so removing it outright would
 * lock franchise owners out of their own gyms.
 */
function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: string[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  describe('platform-only requirements', () => {
    it('REJECTS a gym owner where super_admin is the only accepted role', () => {
      const guard = guardRequiring(['super_admin']);
      expect(() => guard.canActivate(contextFor({ role: 'owner' }))).toThrow(ForbiddenException);
    });

    it('REJECTS a brand_owner too', () => {
      const guard = guardRequiring(['super_admin']);
      expect(() => guard.canActivate(contextFor({ role: 'brand_owner' }))).toThrow(ForbiddenException);
    });

    it('admits an actual super_admin', () => {
      const guard = guardRequiring(['super_admin']);
      expect(guard.canActivate(contextFor({ role: 'super_admin' }))).toBe(true);
    });
  });

  describe('tenant-scoped requirements keep the bypass', () => {
    it('admits a brand_owner where only `owner` is listed', () => {
      // 39 endpoints are @Roles('owner') and rely on this for franchise owners.
      const guard = guardRequiring(['owner']);
      expect(guard.canActivate(contextFor({ role: 'brand_owner' }))).toBe(true);
    });

    it('admits an owner on a mixed platform/tenant decorator', () => {
      const guard = guardRequiring(['owner', 'super_admin']);
      expect(guard.canActivate(contextFor({ role: 'owner' }))).toBe(true);
    });

    it('still rejects a role that holds no listed permission', () => {
      const guard = guardRequiring(['owner', 'manager']);
      expect(() => guard.canActivate(contextFor({ role: 'trainer' }))).toThrow(ForbiddenException);
    });
  });

  describe('basics', () => {
    it('allows through when no roles are required', () => {
      expect(guardRequiring(undefined).canActivate(contextFor({ role: 'trainer' }))).toBe(true);
    });

    it('rejects an unauthenticated request', () => {
      const guard = guardRequiring(['owner']);
      expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
    });

    it('honours the normalized roles array', () => {
      const guard = guardRequiring(['manager']);
      expect(guard.canActivate(contextFor({ role: 'trainer', roles: [{ role_name: 'manager' }] }))).toBe(true);
    });
  });
});
