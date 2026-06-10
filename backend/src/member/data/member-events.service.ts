import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { EventDto } from './dto';
import type { EventIngestResultData } from '../contract';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER EVENTS SERVICE (Phase 3 — funnel / behaviour capture)
 * ────────────────────────────────────────────────────────────────
 *
 * Append-only ingest of client-emitted funnel + conversion events into
 * public.app_user_events, keyed by the app_user from the verified token. The SCC
 * (Phase 4) computes funnels by DISTINCT user per event_type, so duplicate
 * "first_*" emits are harmless. Also advances app_users.onboarding_state from the
 * onboarding events and bumps last_active_at (feeds DAU/WAU/MAU + inactive
 * segmentation). Public schema, not a tenant model — never touches studio data.
 */
@Injectable()
export class MemberEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    appUserId: string,
    events: EventDto[],
  ): Promise<EventIngestResultData> {
    if (!events.length) return { accepted: 0 };

    const rows = events.map((e) => ({
      app_user_id: appUserId,
      event_type: e.type,
      occurred_at: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      platform: e.platform ?? null,
      app_version: e.appVersion ?? null,
      metadata: (e.metadata ?? {}) as Prisma.InputJsonValue,
    }));
    await this.prisma.appUserEvent.createMany({ data: rows });

    const hasCompleted = events.some((e) => e.type === 'onboarding_completed');
    const hasStarted = events.some((e) => e.type === 'onboarding_started');

    // Always freshen activity; complete onboarding if signalled.
    await this.prisma.appUser.update({
      where: { id: appUserId },
      data: {
        last_active_at: new Date(),
        ...(hasCompleted ? { onboarding_state: 'completed' } : {}),
      },
    });
    // started → in_progress, but never downgrade an already-completed onboarding.
    if (hasStarted && !hasCompleted) {
      await this.prisma.appUser.updateMany({
        where: { id: appUserId, NOT: { onboarding_state: 'completed' } },
        data: { onboarding_state: 'in_progress' },
      });
    }

    return { accepted: rows.length };
  }
}
