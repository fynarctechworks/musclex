import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The authenticated member, derived ENTIRELY from the verified member JWT.
 *
 * SECURITY CONVENTION (Checklist §2.2): no /member/* endpoint may accept a
 * `memberId` or `tenantId` from the client (body/query/header). Handlers read
 * identity only via @CurrentMember(). MemberJwtGuard attaches this to the request.
 */
export interface CurrentMemberContext {
  /** app_user id — the canonical person; always present (gym member or public) */
  appUserId: string;
  /**
   * member_id — PK of the member row inside the tenant. Empty string ('') for a
   * gym-less PUBLIC user. Gym endpoints run behind GymMemberGuard, so handlers
   * that read this are guaranteed a real value.
   */
  memberId: string;
  /** tenant id = Studio UUID (drives gym_id scoping). Empty string for public users. */
  tenantId: string;
  /** true once the person is an active gym member (memberId + tenantId present) */
  isGymMember: boolean;
}

/** Key under which MemberJwtGuard stashes the member context on the request. */
export const MEMBER_REQUEST_KEY = 'member';

export const CurrentMember = createParamDecorator(
  (
    data: keyof CurrentMemberContext | undefined,
    ctx: ExecutionContext,
  ): CurrentMemberContext | string | boolean | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const member = request[MEMBER_REQUEST_KEY] as CurrentMemberContext | undefined;
    return data ? member?.[data] : member;
  },
);
