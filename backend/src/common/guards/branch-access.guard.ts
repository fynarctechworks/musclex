import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

const ADMIN_ROLES = ['super_admin', 'owner', 'brand_owner'];

@Injectable()
export class BranchAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admin roles have access to all branches
    if (ADMIN_ROLES.includes(user.role)) {
      return true;
    }

    // Check from normalized roles: null branch_id = all branches
    if (user.roles && Array.isArray(user.roles)) {
      const hasGlobalAccess = user.roles.some(
        (r: { branch_id: string | null }) => r.branch_id === null,
      );
      if (hasGlobalAccess) return true;
    }

    // Check if branch_id is in the request (params, query, or body)
    const branchId =
      request.params?.branch_id ||
      request.query?.branch_id ||
      request.body?.branch_id;

    if (!branchId) {
      return true; // No branch specified, other guards/services handle filtering
    }

    // Check branch_ids array (legacy + populated from UserRole)
    if (user.branch_ids && user.branch_ids.includes(branchId)) {
      return true;
    }

    // Check individual role branch assignments
    if (user.roles && Array.isArray(user.roles)) {
      const hasBranchRole = user.roles.some(
        (r: { branch_id: string | null }) => r.branch_id === branchId,
      );
      if (hasBranchRole) return true;
    }

    throw new ForbiddenException('You do not have access to this branch');
  }
}
