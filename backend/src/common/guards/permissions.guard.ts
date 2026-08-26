import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/permissions.decorator';

const ADMIN_ROLES = ['super_admin', 'owner', 'brand_owner'];

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<RequiredPermission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    /*
     * `@AnyPermissions` — satisfied by ONE of the listed permissions, where
     * `@Permissions` needs all of them. Read from a separate metadata key so
     * the default (all) is unchanged for every route that does not opt in.
     */
    const anyPermissions =
      this.reflector.getAllAndOverride<RequiredPermission[]>(ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    const hasAll = Boolean(requiredPermissions?.length);
    const hasAny = Boolean(anyPermissions?.length);

    if (!hasAll && !hasAny) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admin roles bypass permission checks — log for audit trail
    if (ADMIN_ROLES.includes(user.role)) {
      const permCodes = [...(requiredPermissions ?? []), ...(anyPermissions ?? [])]
        .map((p) => `${p.module}.${p.action}`)
        .join(', ');
      this.logger.log(
        `ADMIN_BYPASS user=${user.user_id} role=${user.role} studio=${user.studio_id} permissions=[${permCodes}] path=${request.method} ${request.url}`,
      );
      return true;
    }

    // Check using permission_codes (normalized RBAC)
    if (user.permission_codes && Array.isArray(user.permission_codes) && user.permission_codes.length > 0) {
      const holdsCode = (required: RequiredPermission) =>
        user.permission_codes.includes(`${required.module}.${required.action}`);

      const hasAllPermissions =
        (!hasAll || requiredPermissions.every(holdsCode)) &&
        (!hasAny || anyPermissions.some(holdsCode));

      if (!hasAllPermissions) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
      return true;
    }

    // Fallback: check using legacy PermissionsMap
    const userPermissions = user.permissions || {};
    const holdsMapped = (required: RequiredPermission) => {
      const modulePerms = userPermissions[required.module];
      return Boolean(modulePerms && modulePerms.includes(required.action));
    };

    const hasAllPermissions =
      (!hasAll || requiredPermissions.every(holdsMapped)) &&
      (!hasAny || anyPermissions.some(holdsMapped));

    if (!hasAllPermissions) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
