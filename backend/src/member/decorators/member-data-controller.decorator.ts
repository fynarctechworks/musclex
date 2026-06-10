import {
  applyDecorators,
  Controller,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MemberJwtGuard } from '../guards/member-jwt.guard';
import { GymMemberGuard } from '../guards/gym-member.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { EnvelopeInterceptor } from '../interceptors/envelope.interceptor';
import { MemberExceptionFilter } from '../filters/member-exception.filter';

/**
 * The shared decorator stack for every GYM-MEMBER data controller, in the correct
 * order: verify the member token → require an active gym membership → set tenant
 * context → idempotency → envelope, with errors rendered as ErrorEnvelope.
 *
 * GymMemberGuard makes every controller using this stack gym-only: a PUBLIC /
 * lead user (no gym) gets a clean 403. Public-fitness endpoints that gym-less
 * users may call use PublicMemberDataController instead. Auth controllers use
 * neither (they are public and unenveloped by contract).
 */
export function MemberDataController(path = 'member/v1') {
  return applyDecorators(
    Controller(path),
    UseGuards(MemberJwtGuard, GymMemberGuard),
    UseInterceptors(
      TenantContextInterceptor,
      IdempotencyInterceptor,
      EnvelopeInterceptor,
    ),
    UseFilters(MemberExceptionFilter),
  );
}

/**
 * The shared stack for member data controllers that gym-LESS public users may
 * call (health/weight/water/goals/nearby-gyms/referral, added from Phase 2 on).
 * Identical to MemberDataController but WITHOUT GymMemberGuard, so any
 * authenticated app_user is allowed. Handlers here must scope by appUserId and
 * must NOT touch studio-scoped Prisma models for a public user.
 */
export function PublicMemberDataController(path = 'member/v1') {
  return applyDecorators(
    Controller(path),
    UseGuards(MemberJwtGuard),
    UseInterceptors(
      TenantContextInterceptor,
      IdempotencyInterceptor,
      EnvelopeInterceptor,
    ),
    UseFilters(MemberExceptionFilter),
  );
}
