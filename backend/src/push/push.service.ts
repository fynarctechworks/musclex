import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { getTenantGymId } from '../common/tenant-context';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Platform push sender for campaign/automation/queue paths (staff-triggered
 * sends to members). Delivers to the member's registered Expo device tokens
 * via the Expo Push API — the same transport the member-BFF
 * MemberNotificationService uses; this one is @Global so the queue processor,
 * campaign sender and automation dispatcher can inject it without importing
 * the whole member module. Honors per-category prefs (opt-out only when
 * explicitly false). Never fakes delivery: no tokens → 0.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
  ) {}

  /** Send to one member. Requires tenant context OR an explicit gymId. */
  async sendToMember(
    memberId: string,
    payload: PushPayload,
    opts?: { gymId?: string; category?: string },
  ): Promise<number> {
    const run = async (): Promise<number> => {
      const tokens = await this.tenant.client.memberDeviceToken.findMany({
        where: { member_id: memberId },
        select: { token: true, prefs: true },
      });

      const targets = tokens
        .filter((t) => {
          if (!opts?.category) return true;
          const prefs = (t.prefs ?? {}) as Record<string, boolean>;
          return prefs[opts.category] !== false;
        })
        .map((t) => t.token)
        .filter((t) => t.startsWith('ExponentPushToken['));

      if (targets.length === 0) {
        this.logger.debug(`Push skipped for member=${memberId} (no Expo tokens). Would send: "${payload.title}".`);
        return 0;
      }

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          targets.map((to) => ({
            to,
            title: payload.title,
            body: payload.body,
            data: payload.data ?? {},
            sound: 'default',
          })),
        ),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`Expo push API ${res.status}: ${err}`);
      }
      this.logger.log(`Push sent to member=${memberId} (${targets.length} device(s)): "${payload.title}"`);
      return targets.length;
    };

    if (getTenantGymId()) return run();
    if (opts?.gymId) return (await this.tasks.runForGym(opts.gymId, run)) ?? 0;
    this.logger.warn(`Push for member=${memberId} dropped — no tenant context or gymId`);
    return 0;
  }
}
