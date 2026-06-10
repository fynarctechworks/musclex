import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

interface PushNotification {
  title: string;
  body: string;
  /** Routed by the app on tap (e.g. { type: 'chat', trainerId }). */
  data?: Record<string, unknown>;
}

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER NOTIFICATION SERVICE (Phase 3 — Push)
 * ────────────────────────────────────────────────────────────────
 *
 * Stores device push tokens (member-owned, gym-scoped) with per-category prefs,
 * and exposes `sendToMember` — the capability the sending apps/jobs call. Sends
 * go via the Expo Push API (works for ExponentPushToken[...] tokens once the EAS
 * project has FCM/APNs creds). It NEVER fakes delivery: with no Expo tokens stored
 * (or sends disabled) it logs what it would send and returns 0. No member-facing
 * trigger is wired yet — triggers arrive with the trainer/admin send paths.
 */
@Injectable()
export class MemberNotificationService {
  private readonly logger = new Logger(MemberNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Upsert a device token (idempotent on the token). */
  async registerToken(
    member: CurrentMemberContext,
    token: string,
    platform: string,
    prefs?: { [key: string]: boolean },
  ): Promise<void> {
    const existing = await this.prisma.memberDeviceToken.findFirst({
      where: { token },
      select: { id: true },
    });
    const data = {
      member_id: member.memberId,
      platform: platform === 'ios' ? 'ios' : 'android',
      prefs: prefs ?? {},
    };
    if (existing) {
      await this.prisma.memberDeviceToken.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.memberDeviceToken.create({
        data: { gym_id: member.tenantId, token, ...data },
      });
    }
  }

  /** Remove a token (on disable / sign-out). */
  async removeToken(member: CurrentMemberContext, token: string): Promise<void> {
    await this.prisma.memberDeviceToken.deleteMany({
      where: { token, member_id: member.memberId },
    });
  }

  /**
   * Send a push to a member, honouring per-category prefs. Returns the number of
   * devices actually dispatched to. Real Expo Push API call — no fake success.
   */
  async sendToMember(
    memberId: string,
    notification: PushNotification,
    category?: string,
  ): Promise<number> {
    const tokens = await this.prisma.memberDeviceToken.findMany({
      where: { member_id: memberId },
      select: { token: true, prefs: true },
    });

    const targets = tokens
      .filter((t) => {
        if (!category) return true;
        const prefs = (t.prefs ?? {}) as Record<string, boolean>;
        return prefs[category] !== false; // opt-out only when explicitly false
      })
      .map((t) => t.token)
      // Expo Push API only accepts Expo push tokens.
      .filter((t) => t.startsWith('ExponentPushToken['));

    if (targets.length === 0) {
      this.logger.debug(
        `Push skipped for member=${memberId} (no Expo tokens / category=${category}). ` +
          `Would send: "${notification.title}".`,
      );
      return 0;
    }

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          targets.map((to) => ({
            to,
            title: notification.title,
            body: notification.body,
            data: notification.data ?? {},
            sound: 'default',
          })),
        ),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push send failed: HTTP ${res.status}`);
        return 0;
      }
      return targets.length;
    } catch (err) {
      this.logger.warn(`Expo push send error: ${err instanceof Error ? err.message : err}`);
      return 0;
    }
  }
}
