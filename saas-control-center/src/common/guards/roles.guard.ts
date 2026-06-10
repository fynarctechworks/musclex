import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Registered globally AFTER JwtAuthGuard. Reads the @Roles(...) allowlist from
 * the handler or class metadata and rejects the request when the authenticated
 * admin's role is not in the list.
 *
 * - @Public() routes bypass entirely (matches JwtAuthGuard's behaviour).
 * - Routes with NO @Roles() allow any authenticated admin (opt-in security).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowed = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // No @Roles annotation → any authenticated admin passes.
    if (!allowed || allowed.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role: AdminRole | undefined = req.user?.role;
    if (!role) {
      // Should not happen — JwtAuthGuard ran first and attaches user.
      throw new ForbiddenException('Role missing on authenticated request');
    }
    if (!allowed.includes(role)) {
      throw new ForbiddenException(
        `This action requires one of: ${allowed.join(', ')}`,
      );
    }
    return true;
  }
}
