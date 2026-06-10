import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStoreService } from '../../events/event-store.service';
import { getTenantGymId } from '../../common/tenant-context';
import { getCorrelationId } from '../../common/correlation-context';
import { AccessPolicyEngine } from './access-policy.engine';
import { QrTokenService } from '../qr/qr-token.service';
import { QrNonceStore } from '../qr/qr-nonce.store';
import type { CheckInContext } from './rule.interface';
import {
  CHECK_IN_DENIED,
  CHECK_IN_OVERRIDDEN,
  CHECK_IN_RECORDED,
  type CheckInDeniedPayload,
  type CheckInOverriddenPayload,
  type CheckInRecordedPayload,
} from '../check-in.events';

export interface OrchestratorInput {
  member_id?: string;
  qr_code?: string;
  branch_id?: string;
  class_id?: string;
  checkin_method: string;
  source?: string;
  client_event_id?: string;
  override_authorized?: boolean;
  override_reason?: string | null;
  override_by_user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface OrchestratorSuccess {
  success: true;
  check_in: unknown;
  check_in_event_id: string;
  member_name: string;
  member_code: string | null;
  membership_status: string;
  membership_end_date: string | null;
  membership_days_remaining: number | null;
  membership_plan_name: string | null;
  warnings: Array<{ rule: string; message: string }>;
}

export interface OrchestratorFailure {
  success: false;
  failure_reason: string;
  message: string;
  severity: 'block' | 'overridable';
  trace: Array<{ rule: string; result: string }>;
  member_name?: string | null;
  member_code?: string | null;
  membership_status?: string | null;
  membership_end_date?: string | null;
  membership_days_remaining?: number | null;
  membership_plan_name?: string | null;
}

export type OrchestratorResult = OrchestratorSuccess | OrchestratorFailure;

/**
 * Single entry point for every check-in attempt.
 *
 * Flow:
 *   1. Resolve the member (QR code or direct id).
 *   2. Load member + active membership + branch.
 *   3. Build context, run AccessPolicyEngine.
 *   4. On deny/overridable-without-override: emit CHECK_IN_DENIED, return failure.
 *   5. On pass / overridden:
 *        $transaction {
 *          - atomic duplicate re-check
 *          - INSERT CheckIn (legacy)
 *          - INSERT CheckInEvent (append-only)
 *          - UPDATE Member.last_visit_at
 *          - DECREMENT class credits
 *          - EVENT CHECK_IN_COMPLETED via EventStoreService
 *        }
 *
 * Idempotency: callers may pass client_event_id; on UNIQUE violation we
 * return the previously-stored event for that id.
 */
@Injectable()
export class CheckInOrchestrator {
  private readonly logger = new Logger(CheckInOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AccessPolicyEngine,
    private readonly eventStore: EventStoreService,
    private readonly eventBus: EventEmitter2,
    private readonly qrTokens: QrTokenService,
    private readonly qrNonces: QrNonceStore,
  ) {}

  async process(input: OrchestratorInput): Promise<OrchestratorResult> {
    const gymId = getTenantGymId();
    if (!gymId) {
      throw new BadRequestException('Tenant context missing');
    }

    // Read once at entry — `getCorrelationId()` reads from ALS set by
    // CorrelationIdMiddleware. We log it alongside every milestone so
    // grep can stitch the whole attempt together later.
    const correlationId = getCorrelationId();
    const tag = correlationId ? `[cid=${correlationId}] ` : '';

    const memberId = await this.resolveMemberId(input);

    const [member, membership, branch] = await Promise.all([
      this.prisma.member.findUnique({
        where: { id: memberId },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              timezone: true,
              opening_time: true,
              closing_time: true,
              organization_id: true,
              city: true,
            },
          },
        },
      }),
      this.prisma.memberMembership.findFirst({
        where: { member_id: memberId, status: 'active' },
        include: {
          plan: {
            select: {
              plan_type: true,
              name: true,
              access_type: true,
              tier: true,
              allowed_branch_ids: true,
              allowed_city: true,
              allowed_hours_json: true,
              organization_id: true,
            },
          },
          branch_access: {
            select: { branch_id: true, expires_at: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      input.branch_id
        ? this.prisma.branch.findUnique({
            where: { id: input.branch_id },
            select: {
              id: true,
              timezone: true,
              opening_time: true,
              closing_time: true,
              organization_id: true,
              city: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!member) throw new BadRequestException('Member not found');

    const branchForCtx = branch ?? {
      id: member.branch.id,
      timezone: (member.branch as any).timezone ?? 'Asia/Kolkata',
      opening_time: member.branch.opening_time,
      closing_time: member.branch.closing_time,
      organization_id: (member.branch as any).organization_id ?? null,
      city: (member.branch as any).city ?? null,
    };

    // Filter membership_branch_access for not-yet-expired grants. The home
    // branch was backfilled into this table in Phase 1 so single_branch
    // members already have at least one row here.
    const nowMs = Date.now();
    const branchAccessIds = (membership as any)?.branch_access
      ? ((membership as any).branch_access as Array<{ branch_id: string; expires_at: Date | null }>)
          .filter((row) => !row.expires_at || row.expires_at.getTime() > nowMs)
          .map((row) => row.branch_id)
      : [];

    const ctx: CheckInContext = {
      gym_id: gymId,
      now: new Date(),
      member: {
        id: member.id,
        status: member.status,
        branch_id: member.branch_id,
        full_name: member.full_name,
        member_code: member.member_code,
      },
      membership: membership
        ? {
            id: membership.id,
            status: membership.status,
            branch_id: membership.branch_id,
            end_date: membership.end_date ?? null,
            grace_end_date: (membership as any).grace_end_date ?? null,
            classes_remaining: membership.classes_remaining,
            freeze_start_date: membership.freeze_start_date ?? null,
            freeze_end_date: membership.freeze_end_date ?? null,
            plan: {
              plan_type: membership.plan.plan_type,
              name: membership.plan.name,
              access_type: (membership.plan as any).access_type ?? 'single_branch',
              tier: (membership.plan as any).tier ?? 'basic',
              allowed_branch_ids: (membership.plan as any).allowed_branch_ids ?? [],
              allowed_city: (membership.plan as any).allowed_city ?? null,
              allowed_hours_json: (membership.plan as any).allowed_hours_json ?? null,
              organization_id: (membership.plan as any).organization_id ?? null,
            },
            branch_access_ids: branchAccessIds,
          }
        : null,
      branch: {
        id: branchForCtx.id,
        timezone: branchForCtx.timezone ?? 'Asia/Kolkata',
        opening_time: branchForCtx.opening_time,
        closing_time: branchForCtx.closing_time,
        organization_id: (branchForCtx as any).organization_id ?? null,
        city: (branchForCtx as any).city ?? null,
      },
      request: {
        branch_id: input.branch_id ?? null,
        class_id: input.class_id ?? null,
        method: input.checkin_method,
        source: input.source ?? 'staff_desktop',
        client_event_id: input.client_event_id ?? null,
        override_authorized: input.override_authorized === true,
        override_reason: input.override_reason ?? null,
      },
      prisma: this.prisma as any,
      derived: {},
    };

    const decision = await this.engine.evaluate(ctx);

    if (decision.decision !== 'pass') {
      this.logger.log(
        `${tag}denied: member=${ctx.member.id} reason=${decision.reason ?? 'unknown'} severity=${decision.severity ?? 'block'}`,
      );
      const deniedEventId = await this.recordDenied(ctx, decision, input, correlationId);

      if (ctx.derived.membership_expired && membership) {
        this.flipExpiredStatuses(membership.id, memberId).catch((e) =>
          this.logger.warn(`${tag}Could not flip expired statuses: ${(e as Error).message}`),
        );
      }

      this.emitDenied(ctx, decision, deniedEventId, correlationId);

      const severity: 'block' | 'overridable' =
        decision.severity === 'block' ? 'block' : 'overridable';
      const endDate = ctx.membership?.end_date ?? null;
      const daysRemaining =
        endDate
          ? Math.ceil(
              (new Date(endDate).getTime() - ctx.now.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;
      return {
        success: false,
        failure_reason: decision.reason ?? 'denied',
        message: decision.message ?? 'Check-in denied',
        severity,
        trace: decision.trace,
        member_name: ctx.member.full_name,
        member_code: ctx.member.member_code ?? null,
        membership_status: ctx.membership?.status ?? null,
        membership_end_date: endDate ? new Date(endDate).toISOString() : null,
        membership_days_remaining: daysRemaining,
        membership_plan_name: ctx.membership?.plan?.name ?? null,
      };
    }

    const success = await this.persistSuccess(ctx, decision, input, correlationId);
    if (success.success) {
      this.logger.log(
        `${tag}recorded: member=${ctx.member.id} event=${success.check_in_event_id} branch=${ctx.request.branch_id ?? ctx.member.branch_id}`,
      );
      this.emitRecorded(ctx, success, input, correlationId);
    }
    return success;
  }

  private async resolveMemberId(input: OrchestratorInput): Promise<string> {
    if (input.member_id) return input.member_id;

    if (!input.qr_code) {
      throw new BadRequestException('Member ID or QR code required');
    }

    // Signed token path — verify HMAC, check qr_version (static) or
    // nonce replay (dynamic), then return the encoded member_id.
    if (this.qrTokens.isSignedToken(input.qr_code)) {
      return this.resolveSignedQr(input);
    }

    // Legacy path — raw UUID stored in members.qr_code. Kept for
    // backward compatibility until every member's QR is rotated to
    // the signed format.
    const member = await this.prisma.member.findFirst({
      where: {
        qr_code: input.qr_code,
        ...(input.branch_id ? { branch_id: input.branch_id } : {}),
      },
      select: { id: true },
    });
    if (!member) throw new BadRequestException('Invalid QR code');
    return member.id;
  }

  private async resolveSignedQr(input: OrchestratorInput): Promise<string> {
    const verified = this.qrTokens.verify(input.qr_code!);
    if (!verified.ok) {
      this.logger.warn(`Signed QR verify failed: ${verified.reason}`);
      throw new BadRequestException('Invalid QR code');
    }

    const gymId = getTenantGymId();
    if (verified.payload.sid !== gymId) {
      throw new BadRequestException('Invalid QR code'); // sid mismatch — wrong tenant
    }

    if (verified.kind === 'static' && verified.payload.typ === 'static') {
      const stc = verified.payload;
      const member = await this.prisma.member.findUnique({
        where: { id: stc.mid },
        select: { id: true, qr_version: true },
      });
      if (!member) throw new BadRequestException('Invalid QR code');
      if (member.qr_version !== stc.ver) {
        // Token was issued against a prior qr_version — likely a sharing
        // attempt with an outdated card after rotation. Reject cleanly.
        this.logger.warn(
          `Static QR version mismatch for member=${stc.mid}: token.ver=${stc.ver}, current=${member.qr_version}`,
        );
        throw new BadRequestException('QR code has been revoked');
      }

      this.recordQrTokenAudit({
        gymId: stc.sid,
        memberId: stc.mid,
        qrVersion: stc.ver,
        kind: 'static',
        branchId: input.branch_id ?? '',
        token: verified.raw_token,
      }).catch((e) => this.logger.warn(`QrTokenAudit write failed: ${(e as Error).message}`));

      return stc.mid;
    }

    if (verified.payload.typ !== 'dynamic') {
      throw new BadRequestException('Invalid QR code');
    }

    // Dynamic — additionally consume the jti nonce.
    const dyn = verified.payload;
    const ttlSec = Math.max(1, dyn.exp - Math.floor(Date.now() / 1000) + 60);
    const claimed = await this.qrNonces.claim(dyn.jti, ttlSec);
    if (!claimed) {
      this.logger.warn(`Dynamic QR replay detected: jti=${dyn.jti} member=${dyn.mid}`);
      throw new BadRequestException('QR code already used');
    }

    this.recordQrTokenAudit({
      gymId: dyn.sid,
      memberId: dyn.mid,
      qrVersion: 0, // dynamic tokens are not versioned
      kind: 'dynamic',
      branchId: input.branch_id ?? '',
      token: verified.raw_token,
      jti: dyn.jti,
    }).catch((e) => this.logger.warn(`QrTokenAudit write failed: ${(e as Error).message}`));

    return dyn.mid;
  }

  private async recordQrTokenAudit(input: {
    gymId: string;
    memberId: string;
    qrVersion: number;
    kind: 'static' | 'dynamic';
    branchId: string;
    token: string;
    jti?: string;
  }) {
    if (!input.branchId) return; // can only persist with a valid branch tied to the audit row
    const jti = input.jti ?? createHash('sha256').update(input.token).digest('hex').slice(0, 24);
    await this.prisma.qrTokenAudit.create({
      data: {
        gym_id: input.gymId,
        jti,
        member_id: input.memberId,
        qr_version: input.qrVersion,
        token_kind: input.kind,
        branch_id: input.branchId,
      },
    }).catch(() => {
      // The jti unique constraint will reject genuine duplicates — for
      // static QRs that is expected behavior under heavy scanning. Silent.
    });
  }

  private async persistSuccess(
    ctx: CheckInContext,
    decision: { trace: { rule: string; result: string }[]; warnings: { rule: string; message: string }[] },
    input: OrchestratorInput,
    correlationId: string | undefined,
  ): Promise<OrchestratorSuccess> {
    const clientEventId = input.client_event_id ?? randomUUID();
    const branchId = ctx.request.branch_id ?? ctx.membership?.branch_id ?? ctx.member.branch_id;

    const policySnapshot = {
      branch_id: branchId,
      method: ctx.request.method,
      source: ctx.request.source,
      correlation_id: correlationId ?? null,
    };

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const { todayStart, todayEnd } = dayBoundsInTz(ctx.now, ctx.branch.timezone);
        const atomicDup = await tx.checkIn.findFirst({
          where: {
            member_id: ctx.member.id,
            checked_in_at: { gte: todayStart, lte: todayEnd },
            status: 'success',
            ...(ctx.request.class_id ? { class_id: ctx.request.class_id } : {}),
          },
          select: { id: true },
        });
        if (atomicDup && !ctx.request.class_id) {
          return { _duplicate: true as const };
        }

        const membershipId = ctx.membership!.id;

        const checkIn = await tx.checkIn.create({
          data: {
            gym_id: ctx.gym_id,
            member_id: ctx.member.id,
            membership_id: membershipId,
            branch_id: branchId,
            class_id: ctx.request.class_id ?? null,
            checkin_method: ctx.request.method,
            status: 'success',
          },
          include: { member: { select: { full_name: true, member_code: true } } },
        });

        const event = await tx.checkInEvent.create({
          data: {
            gym_id: ctx.gym_id,
            member_id: ctx.member.id,
            membership_id: membershipId,
            branch_id: branchId,
            class_id: ctx.request.class_id ?? null,
            client_event_id: clientEventId,
            method: ctx.request.method,
            source: ctx.request.source,
            outcome: ctx.request.override_authorized ? 'overridden' : 'success',
            override_reason: ctx.request.override_reason ?? null,
            override_by_user_id: input.override_by_user_id ?? null,
            policy_snapshot: policySnapshot,
            rule_trace: decision.trace,
            ip_address: input.ip_address ?? null,
            user_agent: input.user_agent ?? null,
            recorded_at: ctx.now,
          },
          select: { id: true },
        });

        await tx.member.update({
          where: { id: ctx.member.id },
          data: { last_visit_at: ctx.now },
        });

        if (
          ctx.membership!.plan.plan_type === 'class_pack' &&
          ctx.membership!.classes_remaining !== null
        ) {
          await tx.memberMembership.update({
            where: { id: membershipId },
            data: { classes_remaining: { decrement: 1 } },
          });
        }

        await this.eventStore.emit(tx, {
          aggregate_type: 'check_in',
          aggregate_id: event.id,
          event_type: 'CHECK_IN_COMPLETED',
          payload: {
            member_id: ctx.member.id,
            membership_id: membershipId,
            branch_id: branchId,
            class_id: ctx.request.class_id ?? null,
            method: ctx.request.method,
            source: ctx.request.source,
            overridden: ctx.request.override_authorized,
            client_event_id: clientEventId,
          },
          branch_id: branchId,
        });

        return { checkIn, eventId: event.id };
      });

      if ('_duplicate' in result) {
        return {
          success: false as any,
          failure_reason: 'already_checked_in',
          message: 'Member has already checked in today',
          severity: 'overridable',
          trace: decision.trace,
        } as unknown as OrchestratorSuccess;
      }

      const { checkIn, eventId } = result;
      const endDate = ctx.membership!.end_date ?? null;
      const daysRemaining =
        endDate
          ? Math.ceil(
              (new Date(endDate).getTime() - ctx.now.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;
      return {
        success: true,
        check_in: checkIn,
        check_in_event_id: eventId,
        member_name: (checkIn as any).member?.full_name ?? ctx.member.full_name,
        member_code: ctx.member.member_code ?? null,
        membership_status: ctx.membership!.status,
        membership_end_date: endDate ? new Date(endDate).toISOString() : null,
        membership_days_remaining: daysRemaining,
        membership_plan_name: ctx.membership?.plan?.name ?? null,
        warnings: decision.warnings,
      };
    } catch (err: any) {
      // P2002 = UNIQUE constraint violation. With (gym_id, client_event_id)
      // it means a previous identical request already persisted — treat as
      // idempotent success by replaying the prior event.
      if (err?.code === 'P2002' && input.client_event_id) {
        const prior = await this.prisma.checkInEvent.findFirst({
          where: { gym_id: ctx.gym_id, client_event_id: input.client_event_id },
          select: { id: true, outcome: true },
        });
        if (prior) {
          this.logger.log(`Idempotent replay: client_event_id=${input.client_event_id} → event ${prior.id}`);
          const replayEndDate = ctx.membership?.end_date ?? null;
          const replayDays =
            replayEndDate
              ? Math.ceil(
                  (new Date(replayEndDate).getTime() - ctx.now.getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : null;
          return {
            success: true,
            check_in: { idempotent_replay: true },
            check_in_event_id: prior.id,
            member_name: ctx.member.full_name,
            member_code: ctx.member.member_code ?? null,
            membership_status: ctx.membership?.status ?? 'unknown',
            membership_end_date: replayEndDate ? new Date(replayEndDate).toISOString() : null,
            membership_days_remaining: replayDays,
            membership_plan_name: ctx.membership?.plan?.name ?? null,
            warnings: decision.warnings,
          };
        }
      }
      throw err;
    }
  }

  private async recordDenied(
    ctx: CheckInContext,
    decision: { reason?: string; message?: string; trace: { rule: string; result: string }[]; severity?: string },
    input: OrchestratorInput,
    correlationId: string | undefined,
  ): Promise<string | null> {
    const clientEventId = input.client_event_id ?? randomUUID();
    const branchId = ctx.request.branch_id ?? ctx.member.branch_id;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const denyEvent = await tx.checkInEvent.create({
          data: {
            gym_id: ctx.gym_id,
            member_id: ctx.member.id,
            membership_id: ctx.membership?.id ?? null,
            branch_id: branchId,
            class_id: ctx.request.class_id ?? null,
            client_event_id: clientEventId,
            method: ctx.request.method,
            source: ctx.request.source,
            outcome: 'denied',
            denial_reason: decision.reason ?? 'unknown',
            policy_snapshot: {
              branch_id: branchId,
              method: ctx.request.method,
              source: ctx.request.source,
              correlation_id: correlationId ?? null,
            },
            rule_trace: decision.trace,
            ip_address: input.ip_address ?? null,
            user_agent: input.user_agent ?? null,
            recorded_at: ctx.now,
          },
          select: { id: true },
        });

        await this.eventStore.emit(tx, {
          aggregate_type: 'check_in',
          aggregate_id: denyEvent.id,
          event_type: 'CHECK_IN_COMPLETED', // shared topic; payload distinguishes outcome
          payload: {
            member_id: ctx.member.id,
            membership_id: ctx.membership?.id ?? null,
            branch_id: branchId,
            method: ctx.request.method,
            source: ctx.request.source,
            outcome: 'denied',
            denial_reason: decision.reason ?? 'unknown',
            client_event_id: clientEventId,
          },
          branch_id: branchId,
        });

        return denyEvent.id;
      });
    } catch (err) {
      // Don't fail the denial response if event logging fails — log and move on.
      this.logger.warn(`Failed to record denied event: ${(err as Error).message}`);
      return null;
    }
  }

  // ── EventEmitter2 fan-out (post-commit, in-process) ──────────────────

  private emitRecorded(
    ctx: CheckInContext,
    success: OrchestratorSuccess,
    input: OrchestratorInput,
    correlationId: string | undefined,
  ) {
    try {
      const branchId = ctx.request.branch_id ?? ctx.membership?.branch_id ?? ctx.member.branch_id;
      const checkInId = (success.check_in as any)?.id ?? success.check_in_event_id;

      const payload: CheckInRecordedPayload = {
        gym_id: ctx.gym_id,
        branch_id: branchId,
        check_in_id: checkInId,
        check_in_event_id: success.check_in_event_id,
        member: {
          id: ctx.member.id,
          full_name: ctx.member.full_name,
          member_code: ctx.member.member_code,
        },
        method: ctx.request.method,
        source: ctx.request.source,
        recorded_at: ctx.now.toISOString(),
        class_id: ctx.request.class_id,
        correlation_id: correlationId,
      };

      this.eventBus.emit(CHECK_IN_RECORDED, payload);

      if (ctx.request.override_authorized) {
        const overridden: CheckInOverriddenPayload = {
          ...payload,
          override_by_user_id: input.override_by_user_id ?? null,
          override_reason: input.override_reason ?? null,
        };
        this.eventBus.emit(CHECK_IN_OVERRIDDEN, overridden);
      }
    } catch (err) {
      this.logger.warn(`Failed to emit CHECK_IN_RECORDED: ${(err as Error).message}`);
    }
  }

  private emitDenied(
    ctx: CheckInContext,
    decision: { reason?: string; message?: string },
    eventId: string | null,
    correlationId: string | undefined,
  ) {
    try {
      const branchId = ctx.request.branch_id ?? ctx.member.branch_id;
      const payload: CheckInDeniedPayload = {
        gym_id: ctx.gym_id,
        branch_id: branchId,
        check_in_event_id: eventId ?? '',
        member: {
          id: ctx.member.id,
          full_name: ctx.member.full_name,
          member_code: ctx.member.member_code,
        },
        denial_reason: decision.reason ?? 'unknown',
        message: decision.message ?? 'Check-in denied',
        recorded_at: ctx.now.toISOString(),
        correlation_id: correlationId,
      };
      this.eventBus.emit(CHECK_IN_DENIED, payload);
    } catch (err) {
      this.logger.warn(`Failed to emit CHECK_IN_DENIED: ${(err as Error).message}`);
    }
  }

  private async flipExpiredStatuses(membershipId: string, memberId: string) {
    await this.prisma.$transaction([
      this.prisma.memberMembership.update({
        where: { id: membershipId },
        data: { status: 'expired' },
      }),
      this.prisma.member.update({
        where: { id: memberId },
        data: { status: 'expired' },
      }),
    ]);
  }
}

function dayBoundsInTz(now: Date, tz: string): { todayStart: Date; todayEnd: Date } {
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const todayStart = new Date(local);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(local);
  todayEnd.setHours(23, 59, 59, 999);
  return { todayStart, todayEnd };
}
