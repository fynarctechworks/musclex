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

    /*
     * Owner-tier bypass.
     *
     * `owner` and `brand_owner` are TENANT roles — they are the top of a single
     * gym, not of the platform. Letting them satisfy every @Roles(...) meant a
     * decorator reading @Roles('super_admin') still admitted a gym owner, so
     * the decorator stopped expressing a real boundary. (Verified: a gym-owner
     * token returned 200 from /api/v1/admin/referrals/analytics/funnel, which
     * is declared super_admin-only.)
     *
     * The bypass is kept for tenant-scoped routes — dozens of endpoints list
     * `owner` but not `brand_owner`, and removing it outright would lock
     * franchise owners out of their own gyms. It is now refused only where the
     * requirement is PLATFORM-ONLY, which is exactly the escalation case.
     */
    const PLATFORM_ONLY_ROLES = new Set(['super_admin']);
    const requiresOnlyPlatformRoles = requiredRoles.every((r) =>
      PLATFORM_ONLY_ROLES.has(r),
    );

    if (!requiresOnlyPlatformRoles) {
      const tenantAdminRoles = ['super_admin', 'owner', 'brand_owner'];
      if (tenantAdminRoles.includes(user.role)) {
        return true;
      }
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
