import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberTokenService } from '../auth/member-token.service';
import {
  CurrentMemberContext,
  MEMBER_REQUEST_KEY,
} from '../decorators/current-member.decorator';
import { PUBLIC_MEMBER_ROUTE_KEY } from '../decorators/public-member-route.decorator';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER JWT GUARD
 * ────────────────────────────────────────────────────────────────
 *
 * Authorizes /member/* routes. Verifies a member access token (aud=member,
 * signed with MEMBER_JWT_SECRET) and attaches { memberId, tenantId } to the
 * request — sourced ONLY from the verified token, never from the client.
 *
 * An admin/Supabase token will fail here (wrong secret + missing aud=member),
 * which — together with the admin JwtAuthGuard rejecting member tokens — gives
 * the audience isolation the TRD/Checklist require.
 *
 * Routes marked @PublicMemberRoute() (the auth endpoints) are skipped.
 */
@Injectable()
export class MemberJwtGuard implements CanActivate {
  constructor(
    private readonly tokens: MemberTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_MEMBER_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing member access token');
    }

    const claims = await this.tokens.verifyAccessToken(authHeader.substring(7));

    const member: CurrentMemberContext = {
      appUserId: claims.appUserId,
      // '' (not the appUserId) for gym-less users, so a public token can never be
      // mistaken for a gym scope. Gym handlers sit behind GymMemberGuard.
      memberId: claims.memberId ?? '',
      tenantId: claims.tenantId ?? '',
      isGymMember: !!claims.memberId && !!claims.tenantId,
    };
    request[MEMBER_REQUEST_KEY] = member;
    return true;
  }
}
