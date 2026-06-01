import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { setTenantContext } from '../../common/tenant-context';
import {
  CurrentMemberContext,
  MEMBER_REQUEST_KEY,
} from '../decorators/current-member.decorator';

/**
 * ────────────────────────────────────────────────────────────────
 * TENANT CONTEXT INTERCEPTOR (member BFF)
 * ────────────────────────────────────────────────────────────────
 *
 * Reuses the EXISTING tenant scoping machinery rather than reinventing it.
 *
 * Flow: the admin TenantMiddleware already ran for this request and created
 * an AsyncLocalStorage tenant store — but with gymId="" because member access
 * tokens carry no `user_metadata.studio_id`. After MemberJwtGuard verifies the
 * token, this interceptor writes the gym (Studio UUID) from the verified claim
 * into that store via setTenantContext(). Every downstream Prisma query then
 * auto-filters by gym_id through the same $use middleware + extension the admin
 * API uses. (No schema switching — multiSchema makes search_path inert; see
 * prisma.service.ts.)
 *
 * Mirrors how ActiveBranchInterceptor mutates the store post-guard.
 *
 * SECURITY: tenantId comes only from the verified member JWT (via the guard),
 * never from a client-supplied value.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const member = request[MEMBER_REQUEST_KEY] as CurrentMemberContext | undefined;

    if (member?.tenantId) {
      setTenantContext({ gymId: member.tenantId });
    }

    return next.handle();
  }
}
