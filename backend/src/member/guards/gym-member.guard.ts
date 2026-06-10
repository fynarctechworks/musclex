import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CurrentMemberContext,
  MEMBER_REQUEST_KEY,
} from '../decorators/current-member.decorator';

/**
 * ────────────────────────────────────────────────────────────────
 * GYM MEMBER GUARD
 * ────────────────────────────────────────────────────────────────
 *
 * Runs AFTER MemberJwtGuard. Allows the request only if the authenticated
 * person is an active gym member (the token carries a tenant + member scope).
 *
 * This is what separates the two member-app audiences:
 *   - PUBLIC / lead users (no gym) → 403 here, so they never reach gym features
 *     (membership, attendance, classes, trainer, gym-scoped data).
 *   - Gym members → pass through to the existing gym endpoints unchanged.
 *
 * Defense-in-depth, not the only line: every studio-scoped Prisma query already
 * fails closed when gym_id is absent (prisma.service.ts). This guard turns that
 * deep ForbiddenException into a clean, early 403 and avoids running handler logic
 * for a user who can't be served.
 *
 * It also enforces OPERATOR SUSPENSION: when the SCC suspends a gym it sets
 * studios.suspended_at; this guard then blocks all gym features for that gym's
 * members (a PK lookup on the member's own tenant — no cross-gym read). Universal
 * / public endpoints (PublicMemberDataController) don't use this guard, so a
 * member's personal health data stays available even while the gym is suspended.
 */
@Injectable()
export class GymMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const member = request[MEMBER_REQUEST_KEY] as
      | CurrentMemberContext
      | undefined;

    if (!member?.isGymMember) {
      throw new ForbiddenException(
        'This feature is only available to gym members.',
      );
    }

    // Block gym features when the operator has suspended this gym. Reads only the
    // member's own tenant by PK (from the verified token) — not cross-gym data.
    const studio = await this.prisma.studio.findUnique({
      where: { id: member.tenantId },
      select: { suspended_at: true },
    });
    if (studio?.suspended_at) {
      throw new ForbiddenException({
        statusCode: 403,
        error_code: 'GYM_SUSPENDED',
        message:
          'This gym is currently suspended. Please contact your gym for details.',
      });
    }

    return true;
  }
}
