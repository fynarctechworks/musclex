import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CROSS_BRANCH_KEY } from '../decorators/cross-branch.decorator';

const ADMIN_ROLES = ['super_admin', 'owner', 'brand_owner'];

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // @CrossBranch() handlers skip branch checks
    const isCrossBranch = this.reflector.getAllAndOverride<boolean>(CROSS_BRANCH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isCrossBranch) return true;

    if (ADMIN_ROLES.includes(user.role)) {
      return true;
    }

    // Null branch_id in roles = all branches
    if (user.roles && Array.isArray(user.roles)) {
      const hasGlobalAccess = user.roles.some(
        (r: { branch_id: string | null }) => r.branch_id === null,
      );
      if (hasGlobalAccess) return true;
    }

    // Check branch_id from request OR from X-Active-Branch-Id header
    const branchId =
      request.params?.branch_id ||
      request.query?.branch_id ||
      request.body?.branch_id ||
      request.headers?.['x-active-branch-id'];

    if (!branchId) {
      return true; // No branch context — extension handles scoping via ALS
    }

    if (user.branch_ids && user.branch_ids.includes(branchId)) {
      return true;
    }

    if (user.roles && Array.isArray(user.roles)) {
      const hasBranchRole = user.roles.some(
        (r: { branch_id: string | null }) => r.branch_id === branchId,
      );
      if (hasBranchRole) return true;
    }

    throw new ForbiddenException('You do not have access to this branch');
  }
}
