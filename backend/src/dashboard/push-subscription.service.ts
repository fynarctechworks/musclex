import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Stores Web Push subscriptions so the Action Queue can escalate
 * high-severity items to a user's mobile device when they're away
 * from the dashboard.
 *
 * The actual VAPID-signed push transmission is delegated to a separate
 * sender (an Edge function or a Bull job) — this service is the
 * registry. Keeping the registry decoupled means the sender can be
 * swapped (web-push library, FCM, OneSignal) without touching the
 * dashboard module.
 */
@Injectable()
export class PushSubscriptionService {
  private readonly logger = new Logger(PushSubscriptionService.name);

  constructor(private readonly tenant: TenantPrisma) {}

  async subscribe(
    user: JwtPayload,
    payload: PushSubscriptionPayload,
    userAgent?: string,
  ): Promise<{ ok: true }> {
    if (!user?.studio_id || !user?.user_id) {
      throw new Error('Missing studio/user context');
    }
    try {
      await this.tenant.client.$executeRawUnsafe(
        `INSERT INTO push_subscriptions (gym_id, user_id, endpoint, p256dh, auth, user_agent, last_used_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NOW())
         ON CONFLICT (gym_id, endpoint) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           last_used_at = NOW()`,
        user.studio_id,
        user.user_id,
        payload.endpoint,
        payload.keys.p256dh,
        payload.keys.auth,
        userAgent ?? null,
      );
      return { ok: true };
    } catch (err) {
      this.logger.warn(
        `subscribe failed (table missing?): ${(err as Error)?.message ?? err}`,
      );
      throw err;
    }
  }

  async unsubscribe(user: JwtPayload, endpoint: string): Promise<{ ok: true }> {
    if (!user?.studio_id) throw new Error('Missing studio context');
    try {
      await this.tenant.client.$executeRawUnsafe(
        `DELETE FROM push_subscriptions WHERE gym_id = $1::uuid AND endpoint = $2`,
        user.studio_id,
        endpoint,
      );
      return { ok: true };
    } catch (err) {
      this.logger.warn(
        `unsubscribe failed: ${(err as Error)?.message ?? err}`,
      );
      throw err;
    }
  }

  /**
   * Returns the public VAPID key the browser uses to subscribe. The actual
   * key is read from env (VAPID_PUBLIC_KEY); the sender keeps the matching
   * private key. Returns null if push isn't configured — frontend then
   * skips offering the prompt.
   */
  getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }
}
