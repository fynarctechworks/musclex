import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Guards service-to-service endpoints with a shared secret header.
 *
 * Used by the SaaS Control Center (and other internal services) to call
 * the main backend without a gym-app JWT. The caller must send:
 *   x-internal-secret: <INTERNAL_API_SECRET>
 *
 * NEVER expose internal endpoints to the public internet without this guard.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-internal-secret'];
    const expected = process.env.INTERNAL_API_SECRET;

    if (!expected) {
      throw new UnauthorizedException('Internal API secret not configured');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
