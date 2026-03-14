import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class EnhancedThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Per-API-key tracking (uses configured rate_limit_per_minute from ApiKey model)
    if (req.user?.api_key_id) {
      return `apikey:${req.user.api_key_id}`;
    }
    // Per-user tracking (authenticated users get more generous limits)
    if (req.user?.user_id) {
      return `user:${req.user.user_id}`;
    }
    // Per-IP tracking (anonymous/unauthenticated)
    return req.ips?.length ? req.ips[0] : req.ip;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Skip rate limiting for health check endpoints
    const request = context.switchToHttp().getRequest();
    if (request.url === '/health' || request.url === '/api/v1/health') {
      return true;
    }
    return false;
  }
}
