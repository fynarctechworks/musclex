import {
  applyDecorators,
  Controller,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MemberJwtGuard } from '../guards/member-jwt.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { EnvelopeInterceptor } from '../interceptors/envelope.interceptor';
import { MemberExceptionFilter } from '../filters/member-exception.filter';

/**
 * The shared decorator stack for every member DATA controller, in the correct
 * order: verify the member token → set tenant context → idempotency → envelope,
 * with errors rendered as ErrorEnvelope. Auth controllers do NOT use this (they
 * are public and unenveloped by contract).
 */
export function MemberDataController(path = 'member/v1') {
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
