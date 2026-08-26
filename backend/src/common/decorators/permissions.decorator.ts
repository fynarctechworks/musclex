import { SetMetadata } from '@nestjs/common';
import { PermissionModule, ModuleAction } from './current-user.decorator';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  module: PermissionModule;
  action: ModuleAction;
}

export const Permissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ANY_PERMISSIONS_KEY = 'any_permissions';

/**
 * Require ANY ONE of these permissions, where `@Permissions` requires all.
 *
 * Needed to introduce a narrower action without taking access away from anyone
 * who already has the broader one. `members.measure` is new, so no existing
 * role carries it — and roles whose permissions come from seeded
 * `RolePermission` rows are not governed by DEFAULT_ROLE_PERMISSIONS. Swapping
 * an endpoint from `edit` to `measure` outright would silently lock out every
 * owner and manager on a live gym.
 *
 * So the endpoint accepts EITHER, and the new action only ever widens.
 */
export const AnyPermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
