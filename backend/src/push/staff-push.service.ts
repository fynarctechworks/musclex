import { Injectable, Logger } from '@nestjs/common';

import { PublicPrismaService } from '../prisma/public-prisma.service';
import { sendViaExpo } from './expo-transport';

export interface StaffPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * ────────────────────────────────────────────────────────────────
 * STAFF PUSH TOKENS
 * ────────────────────────────────────────────────────────────────
 *
 * Tokens live in `public.staff_device_tokens`, keyed by `user_id`, because the
 * same phone can be signed in to an account with roles in several studios.
 * Storing them per-studio would make "clear on sign out" a walk over every
 * studio the user belongs to, and any studio missed keeps pushing to a handset
 * whose owner has signed out.
 */
@Injectable()
export class StaffPushService {
  private readonly logger = new Logger(StaffPushService.name);

  constructor(private readonly pub: PublicPrismaService) {}

  async register(input: {
    userId: string;
    gymId: string;
    token: string;
    platform: string;
    deviceName?: string;
  }): Promise<{ registered: boolean }> {
    if (!input.gymId) {
      // Mid-onboarding there is no studio yet. Registering without one would
      // create a token nothing could ever scope a send to.
      this.logger.debug(`Push registration skipped for user=${input.userId}: no studio context`);
      return { registered: false };
    }

    /*
     * Upsert on (token, gym_id): re-registering the same handset updates
     * rather than duplicating. Expo hands back the same token across app
     * launches, so an insert-only path would fan one phone out into a row per
     * launch and push to it repeatedly.
     */
    await this.pub.staffDeviceToken.upsert({
      where: { token_gym_id: { token: input.token, gym_id: input.gymId } },
      create: {
        user_id: input.userId,
        gym_id: input.gymId,
        token: input.token,
        platform: input.platform,
        device_name: input.deviceName,
      },
      update: {
        // Re-point the row if a different user signs in on the same handset —
        // a shared front-desk phone is normal, and the previous user must stop
        // receiving on it.
        user_id: input.userId,
        platform: input.platform,
        device_name: input.deviceName,
      },
    });

    /*
     * A handset belongs to exactly one person at a time.
     *
     * The upsert above re-points the row for THIS gym, but a previous user's
     * rows for the same handset in OTHER gyms would survive — and that is not
     * a hypothetical: sign-out clears tokens over the network, so a sign-out
     * on a dead connection leaves them behind. Sweeping here means the next
     * sign-in on the device repairs it.
     */
    await this.pub.staffDeviceToken.deleteMany({
      where: { token: input.token, user_id: { not: input.userId } },
    });

    return { registered: true };
  }

  /**
   * Delete a device's token across EVERY gym for this user.
   *
   * Scoped to `user_id` as well as the token so one user cannot unregister
   * another's device by guessing a token string.
   */
  async unregister(userId: string, token: string): Promise<{ removed: number }> {
    const result = await this.pub.staffDeviceToken.deleteMany({
      where: { user_id: userId, token },
    });
    if (result.count > 0) {
      this.logger.log(`Push tokens removed on sign-out: user=${userId} count=${result.count}`);
    }
    return { removed: result.count };
  }

  /** Every live token for a gym's staff — the send target. */
  async tokensForGym(gymId: string): Promise<string[]> {
    const rows = await this.pub.staffDeviceToken.findMany({
      where: { gym_id: gymId },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  /**
   * Send to specific staff members within ONE gym.
   *
   * `gymId` is required and always part of the WHERE clause, never inferred
   * from the ambient tenant context. This table is in `public`, so the Prisma
   * gym_id injection does not cover it — an unscoped query here would push one
   * gym's operational alerts to another gym's staff.
   */
  async sendToStaff(
    gymId: string,
    userIds: string[],
    payload: StaffPushPayload,
  ): Promise<number> {
    if (!gymId || userIds.length === 0) return 0;

    const rows = await this.pub.staffDeviceToken.findMany({
      where: { gym_id: gymId, user_id: { in: userIds } },
      select: { token: true },
    });
    if (rows.length === 0) {
      this.logger.debug(
        `Staff push skipped for gym=${gymId} (no devices registered). Would send: "${payload.title}".`,
      );
      return 0;
    }

    const { sent, deadTokens } = await sendViaExpo(
      rows.map((r) => ({
        to: r.token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default' as const,
      })),
    );

    if (deadTokens.length > 0) {
      // Uninstalled apps and rotated tokens never recover. Keeping them would
      // mean every future send re-attempts a handset that no longer exists.
      await this.pub.staffDeviceToken.deleteMany({
        where: { gym_id: gymId, token: { in: deadTokens } },
      });
      this.logger.log(`Pruned ${deadTokens.length} dead staff token(s) for gym=${gymId}`);
    }

    this.logger.log(`Staff push sent gym=${gymId} devices=${sent}: "${payload.title}"`);
    return sent;
  }
}
