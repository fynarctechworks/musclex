import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The authenticated member, derived ENTIRELY from the verified member JWT.
 *
 * SECURITY CONVENTION (Checklist §2.2): no /member/* endpoint may accept a
 * `memberId` or `tenantId` from the client (body/query/header). Handlers read
 * identity only via @CurrentMember(). MemberJwtGuard attaches this to the request.
 */
export interface CurrentMemberContext {
  /** member_id — PK of the member row inside the tenant */
  memberId: string;
  /** tenant id = Studio UUID (drives gym_id scoping) */
  tenantId: string;
}

/** Key under which MemberJwtGuard stashes the member context on the request. */
export const MEMBER_REQUEST_KEY = 'member';

export const CurrentMember = createParamDecorator(
  (
    data: keyof CurrentMemberContext | undefined,
    ctx: ExecutionContext,
  ): CurrentMemberContext | string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const member = request[MEMBER_REQUEST_KEY] as CurrentMemberContext | undefined;
    return data ? member?.[data] : member;
  },
);
