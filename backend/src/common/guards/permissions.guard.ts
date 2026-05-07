import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
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

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admin roles bypass permission checks — log for audit trail
    if (ADMIN_ROLES.includes(user.role)) {
      const permCodes = requiredPermissions.map((p) => `${p.module}.${p.action}`).join(', ');
      this.logger.log(
        `ADMIN_BYPASS user=${user.user_id} role=${user.role} studio=${user.studio_id} permissions=[${permCodes}] path=${request.method} ${request.url}`,
      );
      return true;
    }

    // Check using permission_codes (normalized RBAC)
    if (user.permission_codes && Array.isArray(user.permission_codes) && user.permission_codes.length > 0) {
      const hasAllPermissions = requiredPermissions.every((required) => {
        const code = `${required.module}.${required.action}`;
        return user.permission_codes.includes(code);
      });

      if (!hasAllPermissions) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
      return true;
    }

    // Fallback: check using legacy PermissionsMap
    const userPermissions = user.permissions || {};
    const hasAllPermissions = requiredPermissions.every((required) => {
      const modulePerms = userPermissions[required.module];
      return modulePerms && modulePerms.includes(required.action);
    });

    if (!hasAllPermissions) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
