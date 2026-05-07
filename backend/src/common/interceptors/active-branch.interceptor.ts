import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { setBranchContext } from '../tenant-context';
import { CROSS_BRANCH_KEY } from '../decorators/cross-branch.decorator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Populates branch-scoping fields in the AsyncLocalStorage tenant store.
 *
 * Runs after guards so `req.user` is already set. Reads the
 * `X-Active-Branch-Id` header, validates it against the user's allowed
 * branches, and writes the resolved context via `setBranchContext()`.
 */
@Injectable()
export class ActiveBranchInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    const headerValue: string | undefined = req.headers['x-active-branch-id'];
    const activeBranchId =
      headerValue && UUID_REGEX.test(headerValue) ? headerValue : null;

    // ── Determine allowed branches ────────────────────────────────────
    let allowedBranchIds: string[] | 'ALL' = [];

    if (user) {
      const role: string | undefined = user.role;

      if (role === 'owner' || role === 'super_admin' || role === 'brand_owner') {
        allowedBranchIds = 'ALL';
      } else {
        const ids = new Set<string>();

        if (Array.isArray(user.branch_ids)) {
          for (const id of user.branch_ids) {
            if (typeof id === 'string' && UUID_REGEX.test(id)) {
              ids.add(id);
            }
          }
        }

        if (Array.isArray(user.roles)) {
          for (const entry of user.roles) {
            if (
              entry &&
              typeof entry.branch_id === 'string' &&
              UUID_REGEX.test(entry.branch_id)
            ) {
              ids.add(entry.branch_id);
            }
          }
        }

        allowedBranchIds = Array.from(ids);
      }
    }

    // ── Validate header against allowed branches ──────────────────────
    let resolvedBranchId = activeBranchId;

    if (resolvedBranchId && allowedBranchIds !== 'ALL') {
      if (allowedBranchIds.length === 0) {
        // Staff with no branch assignments — ignore header, don't block login flow
        resolvedBranchId = null;
      } else if (!allowedBranchIds.includes(resolvedBranchId)) {
        throw new ForbiddenException('BRANCH_NOT_ACCESSIBLE');
      }
    }

    // ── Auto-select when user has exactly one branch and no header ────
    if (
      !resolvedBranchId &&
      Array.isArray(allowedBranchIds) &&
      allowedBranchIds.length === 1
    ) {
      resolvedBranchId = allowedBranchIds[0];
    }

    // ── @CrossBranch() check ──────────────────────────────────────────
    const bypassBranchScope = this.reflector.getAllAndOverride<boolean>(
      CROSS_BRANCH_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? false;

    // ── Write to ALS store ────────────────────────────────────────────
    setBranchContext({
      activeBranchId: resolvedBranchId,
      allowedBranchIds,
      bypassBranchScope,
    });

    return next.handle();
  }
}
