import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check primary role (backward compat)
    if (requiredRoles.includes(user.role)) {
      return true;
    }

    // Check all normalized roles
    if (user.roles && Array.isArray(user.roles)) {
      const hasRole = user.roles.some((r: { role_name: string }) =>
        requiredRoles.includes(r.role_name),
      );
      if (hasRole) return true;
    }

    // Super admin / owner / brand_owner bypass
    const adminRoles = ['super_admin', 'owner', 'brand_owner'];
    if (adminRoles.includes(user.role)) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
