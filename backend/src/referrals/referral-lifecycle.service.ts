import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { Prisma } from '../../node_modules/.prisma/client-public';
import {
  REFERRAL_EVENTS,
  LifecycleTransitionedPayload,
} from './events/domain-events';

/**
 * Lifecycle FSM for B2B referrals (studio → studio).
 *
 * Allowed transitions:
 *   pending → registered → trial_started → subscribed
 *          → payment_verified → reward_pending → rewarded
 *          → reversed | fraud | expired
 *
 * Rules:
 *   * Transitions are strictly forward (no rewinds), except:
 *       - any → fraud
 *       - any non-terminal → expired
 *       - rewarded → reversed (refunds)
 *   * Every transition writes a ReferralLifecycleEvent row (append-only audit).
 *   * Concurrent transitions race on a conditional UPDATE — only one wins.
 */
@Injectable()
export class ReferralLifecycleService {
  private readonly logger = new Logger(ReferralLifecycleService.name);

  /** Map of allowed { from → set(to) } transitions. */
  private readonly TRANSITIONS: Record<string, Set<string>> = {
    pending:         new Set(['registered', 'trial_started', 'subscribed', 'fraud', 'expired']),
    registered:      new Set(['trial_started', 'subscribed', 'fraud', 'expired']),
    trial_started:   new Set(['subscribed', 'fraud', 'expired']),
    subscribed:      new Set(['payment_verified', 'fraud', 'expired']),
    payment_verified:new Set(['reward_pending', 'fraud', 'reversed']),
    reward_pending:  new Set(['rewarded', 'fraud', 'reversed']),
    rewarded:        new Set(['reversed']),
    // terminal states
    reversed:        new Set(),
    fraud:           new Set(),
    expired:         new Set(),
  };

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Attempt to transition a referral to a new status.
   * Uses an optimistic conditional UPDATE for safety under concurrency.
   *
   * Returns true if the transition was applied, false if blocked
   * (illegal transition or already in target state).
   */
  async transition(params: {
    referralId: string;
    toStatus: string;
    actorType?: 'system' | 'admin' | 'webhook' | 'gym_owner';
    actorId?: string;
    payload?: Record<string, unknown>;
  }): Promise<boolean> {
    const { referralId, toStatus, actorType = 'system', actorId, payload = {} } = params;

    const referral = await this.pub.referral.findUnique({
      where: { id: referralId },
      select: { id: true, status: true },
    });
    if (!referral) {
      this.logger.warn(`transition: referral ${referralId} not found`);
      return false;
    }

    const fromStatus = referral.status;
    if (fromStatus === toStatus) {
      this.logger.debug(`transition no-op: ${referralId} already ${toStatus}`);
      return false;
    }

    if (!this.isAllowed(fromStatus, toStatus)) {
      this.logger.warn(
        `Illegal transition refused: ${referralId} ${fromStatus} → ${toStatus}`,
      );
      return false;
    }

    // Conditional update — only succeeds if status hasn't changed since read.
    const updated = await this.pub.referral.updateMany({
      where: { id: referralId, status: fromStatus },
      data:  { status: toStatus, updated_at: new Date() },
    });

    if (updated.count === 0) {
      this.logger.warn(
        `Race lost on transition ${referralId}: ${fromStatus} → ${toStatus}`,
      );
      return false;
    }

    // Append-only audit row
    await this.pub.referralLifecycleEvent.create({
      data: {
        referral_id: referralId,
        from_status: fromStatus,
        to_status:   toStatus,
        actor_type:  actorType,
        actor_id:    actorId ?? null,
        payload:     payload as unknown as Prisma.InputJsonValue,
      },
    });

    const transitionPayload: LifecycleTransitionedPayload = {
      scope: 'b2b',
      referralId,
      fromStatus,
      toStatus,
      actorType,
      actorId,
      payload,
    };
    this.eventEmitter.emit(REFERRAL_EVENTS.LIFECYCLE_TRANSITIONED, transitionPayload);

    this.logger.log(`Referral ${referralId}: ${fromStatus} → ${toStatus}`);
    return true;
  }

  /**
   * Strict variant — throws if the transition is illegal.
   * Use when caller MUST advance the state and partial failure is unacceptable.
   */
  async transitionOrThrow(params: Parameters<typeof this.transition>[0]): Promise<void> {
    const ok = await this.transition(params);
    if (!ok) {
      throw new ConflictException(
        `Cannot transition referral ${params.referralId} to ${params.toStatus}`,
      );
    }
  }

  isAllowed(from: string, to: string): boolean {
    return this.TRANSITIONS[from]?.has(to) ?? false;
  }

  /** Returns the full history for a referral, oldest-first. */
  async getHistory(referralId: string) {
    return this.pub.referralLifecycleEvent.findMany({
      where:   { referral_id: referralId },
      orderBy: { occurred_at: 'asc' },
    });
  }
}
