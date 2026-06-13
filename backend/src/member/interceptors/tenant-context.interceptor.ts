import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { setTenantContext } from '../../common/tenant-context';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
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
 * into that store via setTenantContext(). Under Road B (per-gym physical
 * schemas) the store must also carry the gym's `schemaName` so the tenant client
 * routes to the right schema — we resolve it from the registry (public.studios)
 * and cache it (schema_name is immutable per gym).
 *
 * Mirrors how ActiveBranchInterceptor mutates the store post-guard.
 *
 * SECURITY: tenantId comes only from the verified member JWT (via the guard),
 * never from a client-supplied value.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  // gym_id -> schema_name. Stable for a gym's lifetime, so cache to avoid a
  // registry round-trip on every member request.
  private readonly schemaCache = new Map<string, string>();

  constructor(private readonly pub: PublicPrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const member = request[MEMBER_REQUEST_KEY] as CurrentMemberContext | undefined;

    if (member?.tenantId) {
      const schemaName = await this.resolveSchema(member.tenantId);
      // Gym-independent public app users have no tenant data, so a missing
      // schema is fine — only gym-scoped routes touch the tenant client.
      setTenantContext({ gymId: member.tenantId, schemaName });
    }

    return next.handle();
  }

  private async resolveSchema(gymId: string): Promise<string | undefined> {
    const cached = this.schemaCache.get(gymId);
    if (cached) return cached;
    const studio = await this.pub.studio.findUnique({
      where: { id: gymId },
      select: { schema_name: true },
    });
    if (studio?.schema_name) {
      this.schemaCache.set(gymId, studio.schema_name);
      return studio.schema_name;
    }
    return undefined;
  }
}
