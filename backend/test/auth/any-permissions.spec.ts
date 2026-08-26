import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from '../../src/common/guards/permissions.guard';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../../src/common/decorators/permissions.decorator';

/**
 * `@AnyPermissions` — satisfied by ONE of several permissions.
 *
 * Added so a NARROW action (`members.measure`) could be introduced without
 * taking access from anyone who already holds the broad one (`members.edit`).
 * Roles seeded from RolePermission rows are not governed by
 * DEFAULT_ROLE_PERMISSIONS, so swapping the endpoint outright would have
 * locked out every owner and manager on a live gym.
 *
 * The property that matters most on a SHARED guard: routes that do not opt in
 * must behave exactly as before.
 */
describe('PermissionsGuard — AnyPermissions', () => {
  function contextFor(user: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, method: 'POST', url: '/x' }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  /** A reflector returning fixed metadata for each key. */
  function reflectorWith(all?: unknown, any?: unknown): Reflector {
    return {
      getAllAndOverride: (key: string) =>
        key === PERMISSIONS_KEY ? all : key === ANY_PERMISSIONS_KEY ? any : undefined,
    } as unknown as Reflector;
  }

  const MEASURE = { module: 'members', action: 'measure' };
  const EDIT = { module: 'members', action: 'edit' };

  const withCodes = (...codes: string[]) => ({
    role: 'trainer',
    user_id: 'u1',
    studio_id: 's1',
    permission_codes: codes,
  });

  const withMap = (map: Record<string, string[]>) => ({
    role: 'trainer',
    user_id: 'u1',
    studio_id: 's1',
    permissions: map,
  });

  describe('the new behaviour', () => {
    it('admits a trainer holding only the NARROW action', () => {
      const guard = new PermissionsGuard(reflectorWith(undefined, [MEASURE, EDIT]));
      expect(guard.canActivate(contextFor(withCodes('members.view', 'members.measure'))))
        .toBe(true);
    });

    it('still admits anyone holding only the BROAD action', () => {
      // The regression this guards: an owner or manager seeded from
      // RolePermission rows has 'edit' and will never have 'measure'.
      const guard = new PermissionsGuard(reflectorWith(undefined, [MEASURE, EDIT]));
      expect(guard.canActivate(contextFor(withCodes('members.view', 'members.edit'))))
        .toBe(true);
    });

    it('refuses somebody holding NEITHER', () => {
      const guard = new PermissionsGuard(reflectorWith(undefined, [MEASURE, EDIT]));
      expect(() => guard.canActivate(contextFor(withCodes('members.view'))))
        .toThrow(ForbiddenException);
    });

    it('works through the legacy permissions map too', () => {
      const guard = new PermissionsGuard(reflectorWith(undefined, [MEASURE, EDIT]));
      expect(guard.canActivate(contextFor(withMap({ members: ['view', 'measure'] }))))
        .toBe(true);
      expect(() => guard.canActivate(contextFor(withMap({ members: ['view'] }))))
        .toThrow(ForbiddenException);
    });
  });

  describe('routes that do NOT opt in are unchanged', () => {
    it('still requires EVERY listed permission', () => {
      const guard = new PermissionsGuard(reflectorWith([EDIT, MEASURE], undefined));
      // Holding one of two is not enough for @Permissions.
      expect(() => guard.canActivate(contextFor(withCodes('members.edit'))))
        .toThrow(ForbiddenException);
      expect(guard.canActivate(contextFor(withCodes('members.edit', 'members.measure'))))
        .toBe(true);
    });

    it('still allows a route with no permission metadata at all', () => {
      const guard = new PermissionsGuard(reflectorWith(undefined, undefined));
      expect(guard.canActivate(contextFor(withCodes()))).toBe(true);
    });

    it('still refuses an unauthenticated caller', () => {
      const guard = new PermissionsGuard(reflectorWith(undefined, [MEASURE]));
      expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
    });
  });

  describe('admin bypass', () => {
    it('still lets an owner through and does not crash building its log line', () => {
      // The bypass logs the required codes; it used to read only the 'all'
      // list, which is undefined on an any-of route.
      const guard = new PermissionsGuard(reflectorWith(undefined, [MEASURE, EDIT]));
      expect(guard.canActivate(contextFor({ role: 'owner', user_id: 'o1', studio_id: 's1' })))
        .toBe(true);
    });
  });
});
