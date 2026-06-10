import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_WHEN_LOCKED_KEY } from '../decorators/allow-when-locked.decorator';
import { SubscriptionPolicyService } from '../services/subscription-policy.service';
import { JwtPayload } from '../decorators/current-user.decorator';

/**
 * Global guard that blocks WRITE operations when a tenant is LOCKED or SUSPENDED.
 *
 * Rules:
 *   1. GET requests → always allowed (read-only mode preserves trust + value).
 *   2. POST/PUT/PATCH/DELETE → blocked unless the route is @AllowWhenLocked() OR
 *      the URL is in the always-allowed prefix list (auth/subscription/health).
 *   3. ACTIVE → writes allowed. GRACE_PERIOD / LOCKED / SUSPENDED → writes blocked.
 *      Grace is read-only too: the studio must renew to a fully paid state before
 *      mutations resume. Renewal preserves all tenant data — it only flips
 *      lifecycle_status back to active and extends next_billing_date.
 *
 * Returns 403 with { error_code: 'SUBSCRIPTION_LOCKED' } so the frontend can
 * recognize it deterministically and surface the renewal modal.
 *
 * Registered as APP_GUARD AFTER JwtAuthGuard so request.user is populated.
 */
@Injectable()
export class SubscriptionLockGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionLockGuard.name);

  // URL prefixes that must work even when LOCKED — billing, auth, status.
  // Note: matched after '/api/v1/' is stripped; we still check the full path
  // for safety.
  private static readonly ALWAYS_ALLOWED_PREFIXES = [
    '/api/v1/auth/',
    '/api/v1/subscription/',
    '/api/v1/settings/subscription',
    '/api/v1/settings/account',
    '/api/v1/settings/invoices',
    '/api/v1/settings/plans',
    '/health',
  ];

  // Methods that are unconditionally safe (read-only).
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  constructor(
    private readonly reflector: Reflector,
    private readonly policy: SubscriptionPolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Safe methods are never blocked.
    if (SubscriptionLockGuard.SAFE_METHODS.has(request.method)) return true;

    // 2. URL prefix whitelist.
    const url: string = request.originalUrl || request.url || '';
    if (
      SubscriptionLockGuard.ALWAYS_ALLOWED_PREFIXES.some((p) =>
        url.startsWith(p),
      )
    ) {
      return true;
    }

    // 3. Route-level opt-out.
    const allow = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WHEN_LOCKED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allow) return true;

    // 4. No authenticated user yet → JwtAuthGuard will handle it. Don't
    //    double-reject here; let auth flow first.
    const user = request.user as JwtPayload | undefined;
    if (!user?.studio_id) return true;

    // 5. Resolve subscription context. Prefer the value JwtAuthGuard already
    //    populated; fall back to the policy service (cached, ~1ms).
    const subscription =
      user.subscription ?? (await this.policy.getContext(user.studio_id));

    if (subscription.can_mutate) return true;

    this.logger.warn(
      `SUBSCRIPTION_LOCKED blocked ${request.method} ${url} ` +
        `(studio=${user.studio_id} status=${subscription.status} user=${user.user_id})`,
    );

    throw new ForbiddenException({
      statusCode: 403,
      error_code: 'SUBSCRIPTION_LOCKED',
      message:
        subscription.status === 'suspended'
          ? 'Your account is suspended. Contact support to restore access.'
          : subscription.status === 'grace_period'
            ? 'Your subscription has expired and is in the grace period. Renew now to continue making changes.'
            : 'Your subscription has expired. Renew to continue making changes.',
      subscription: {
        status: subscription.status,
        plan: subscription.plan,
        expires_at: subscription.expires_at,
        grace_until: subscription.grace_until,
        locked_at: subscription.locked_at,
      },
    });
  }
}
