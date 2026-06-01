import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckInOrchestrator } from '../../check-ins/policy/check-in.orchestrator';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { computeStreakDays } from './mappers';
import type { CheckInResultData } from '../contract';

/**
 * Member self check-in. Reuses the admin CheckInOrchestrator so ALL access
 * policy rules (active membership, branch access, duplicate window, class
 * credits, …) are enforced identically to the front-desk path — we do NOT
 * reinvent check-in business logic.
 *
 * The member is already authenticated, so we resolve by member_id (from the
 * JWT), not by scanning a QR. Server-side validation of a gym/turnstile QR
 * token is a separate concern (deferred) — the orchestrator's policy engine is
 * the authoritative gate here. HTTP-level dedup is handled by the Idempotency
 * interceptor; we also pass the key as client_event_id for orchestrator-level
 * dedup (belt and suspenders).
 */
@Injectable()
export class MemberCheckInService {
  private readonly streakWindowDays = 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: CheckInOrchestrator,
  ) {}

  async checkIn(
    member: CurrentMemberContext,
    input: { method: 'qr' | 'manual'; token?: string; occurredAt?: string },
    idempotencyKey?: string,
  ): Promise<CheckInResultData> {
    const m = await this.prisma.member.findFirst({
      where: { id: member.memberId },
      select: { branch_id: true },
    });
    if (!m) throw MemberException.notFound('Member not found.');

    const result = await this.orchestrator.process({
      member_id: member.memberId,
      branch_id: m.branch_id,
      checkin_method: input.method,
      source: 'member_app',
      client_event_id: idempotencyKey,
    });

    if (!result.success) {
      // Policy denial → surface the human-readable reason; overridable denials
      // are retryable (e.g. transient), hard blocks are not.
      throw MemberException.conflict(
        result.message,
        result.severity === 'overridable',
      );
    }

    const since = new Date(Date.now() - this.streakWindowDays * 86_400_000);
    const checkIns = await this.prisma.checkIn.findMany({
      where: { member_id: member.memberId, checked_in_at: { gte: since } },
      select: { checked_in_at: true },
    });

    return {
      checkInId: (result.check_in as { id?: string })?.id ?? result.check_in_event_id,
      recordedAt: new Date().toISOString(),
      alreadyRecorded: false,
      streakDays: computeStreakDays(checkIns.map((c) => c.checked_in_at)),
    };
  }
}
