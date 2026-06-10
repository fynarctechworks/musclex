import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReferralsService } from '../../src/referrals/referrals.service';
import { RuleEngineService } from '../../src/referrals/rule-engine.service';
import { RewardProcessorService } from '../../src/referrals/reward-processor.service';
import { ReferralLifecycleService } from '../../src/referrals/referral-lifecycle.service';
import { ReferralFraudService } from '../../src/referrals/referral-fraud.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  REFERRAL_EVENTS,
  SubscriptionActivatedPayload,
  TrialCompletedPayload,
} from '../../src/referrals/events/domain-events';

/**
 * Tests for the two-stage reward pipeline introduced for the trial-completion
 * model:
 *
 *   Stage 1: SUBSCRIPTION_ACTIVATED (first payment during trial)
 *            → moves referral to `payment_verified` and STOPS.
 *            No reward credited — the gym could still trial-cancel.
 *
 *   Stage 2: TRIAL_COMPLETED (trial ended, gym still active)
 *            → runs the fraud re-check + rule engine + reward credit
 *            (apply-extension on the referrer's subscription).
 *
 * The split closes the "pay → trial-cancel → keep reward" fraud loop.
 */
describe('ReferralsService — trial-completion reward pipeline', () => {
  let service: ReferralsService;
  let prisma: any;
  let rewardProcessor: any;
  let lifecycle: any;
  let fraud: any;
  let ruleEngine: any;

  const activationPayload = (studioId: string): SubscriptionActivatedPayload => ({
    studioId,
    planId: 'plan-1',
    planName: 'enterprise',
    billingCycle: 'monthly',
    amountPaid: 4999,
    currency: 'INR',
    idempotencyKey: 'inv-1',
    activatedAt: new Date(),
  });

  const trialCompletedPayload = (studioId: string): TrialCompletedPayload => ({
    studioId,
    planId: 'plan-1',
    planName: 'enterprise',
    billingCycle: 'monthly',
    amountPaid: 4999,
    currency: 'INR',
    idempotencyKey: 'trial-end-1',
    trialEndedAt: new Date(),
  });

  beforeEach(async () => {
    prisma = {
      referral: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    rewardProcessor = { processRewards: jest.fn().mockResolvedValue([{ ruleId: 'r1' }]) };
    lifecycle = { transition: jest.fn().mockResolvedValue(true) };
    fraud = {
      collectSignals: jest.fn().mockResolvedValue(0),
      shouldMarkFraud: jest.fn().mockReturnValue(false),
      shouldHoldForReview: jest.fn().mockReturnValue(false),
    };
    ruleEngine = {
      evaluate: jest.fn().mockResolvedValue([
        { id: 'rule-1', name: 'Default', rewards: [{ type: 'extend_subscription', days: 30 }] },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RuleEngineService, useValue: ruleEngine },
        { provide: RewardProcessorService, useValue: rewardProcessor },
        { provide: ReferralLifecycleService, useValue: lifecycle },
        { provide: ReferralFraudService, useValue: fraud },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReferralsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Stage 1: activation → payment_verified, NO reward ─────────────

  describe('handleSubscriptionActivated (Stage 1)', () => {
    it('advances to payment_verified but does NOT credit reward', async () => {
      prisma.referral.findUnique.mockResolvedValue({ id: 'ref-1', status: 'pending' });

      await service.handleSubscriptionActivated(activationPayload('studio-B'));

      // Lifecycle moves through subscribed → payment_verified
      const transitions = lifecycle.transition.mock.calls.map((c: any[]) => c[0].toStatus);
      expect(transitions).toContain('subscribed');
      expect(transitions).toContain('payment_verified');
      // But NEVER touches reward stages
      expect(transitions).not.toContain('reward_pending');
      expect(transitions).not.toContain('rewarded');
      expect(rewardProcessor.processRewards).not.toHaveBeenCalled();
    });

    it('is idempotent — re-activation on an already payment_verified referral is a no-op', async () => {
      prisma.referral.findUnique.mockResolvedValue({ id: 'ref-2', status: 'payment_verified' });

      await service.handleSubscriptionActivated(activationPayload('studio-B'));

      expect(lifecycle.transition).not.toHaveBeenCalled();
      expect(rewardProcessor.processRewards).not.toHaveBeenCalled();
    });

    it('skips when no referral exists for the studio', async () => {
      prisma.referral.findUnique.mockResolvedValue(null);

      await service.handleSubscriptionActivated(activationPayload('studio-noref'));

      expect(lifecycle.transition).not.toHaveBeenCalled();
      expect(rewardProcessor.processRewards).not.toHaveBeenCalled();
    });

    it('skips terminal states (fraud/reversed/expired)', async () => {
      for (const status of ['fraud', 'reversed', 'expired']) {
        jest.clearAllMocks();
        prisma.referral.findUnique.mockResolvedValue({ id: `ref-${status}`, status });

        await service.handleSubscriptionActivated(activationPayload('studio-B'));

        expect(lifecycle.transition).not.toHaveBeenCalled();
        expect(rewardProcessor.processRewards).not.toHaveBeenCalled();
      }
    });
  });

  // ── Stage 2: trial completion → reward actually credits ───────────

  describe('handleTrialCompleted (Stage 2)', () => {
    it('credits the reward when the referral is at payment_verified', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-3',
        status: 'payment_verified',
        referrer_studio_id: 'studio-A',
        referred_studio_id: 'studio-B',
        idempotency_key: null,
        referrer_studio: { id: 'studio-A', country: 'IN' },
        referred_studio: { id: 'studio-B', country: 'IN' },
      });

      await service.handleTrialCompleted(trialCompletedPayload('studio-B'));

      expect(rewardProcessor.processRewards).toHaveBeenCalledWith(
        expect.objectContaining({
          referralId: 'ref-3',
          referrerStudioId: 'studio-A',
          eventType: REFERRAL_EVENTS.TRIAL_COMPLETED,
        }),
      );
      const transitions = lifecycle.transition.mock.calls.map((c: any[]) => c[0].toStatus);
      expect(transitions).toContain('reward_pending');
      expect(transitions).toContain('rewarded');
    });

    it('is idempotent — re-firing for an already-rewarded referral is a no-op', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-4',
        status: 'rewarded',
        referrer_studio_id: 'studio-A',
        referred_studio_id: 'studio-B',
        referrer_studio: { id: 'studio-A', country: 'IN' },
        referred_studio: { id: 'studio-B', country: 'IN' },
      });

      await service.handleTrialCompleted(trialCompletedPayload('studio-B'));

      expect(rewardProcessor.processRewards).not.toHaveBeenCalled();
    });

    it('holds the reward when fraud signals push risk above review threshold', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-5',
        status: 'payment_verified',
        referrer_studio_id: 'studio-A',
        referred_studio_id: 'studio-B',
        idempotency_key: null,
        referrer_studio: { id: 'studio-A', country: 'IN' },
        referred_studio: { id: 'studio-B', country: 'IN' },
      });
      fraud.collectSignals.mockResolvedValue(60);
      fraud.shouldHoldForReview.mockReturnValue(true);

      await service.handleTrialCompleted(trialCompletedPayload('studio-B'));

      expect(rewardProcessor.processRewards).not.toHaveBeenCalled();
      const transitions = lifecycle.transition.mock.calls.map((c: any[]) => c[0].toStatus);
      expect(transitions).not.toContain('rewarded');
    });

    it('auto-flags as fraud when risk_score crosses the fraud threshold', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-6',
        status: 'payment_verified',
        referrer_studio_id: 'studio-A',
        referred_studio_id: 'studio-B',
        idempotency_key: null,
        referrer_studio: { id: 'studio-A', country: 'IN' },
        referred_studio: { id: 'studio-B', country: 'IN' },
      });
      fraud.collectSignals.mockResolvedValue(100);
      fraud.shouldMarkFraud.mockReturnValue(true);

      await service.handleTrialCompleted(trialCompletedPayload('studio-B'));

      const transitions = lifecycle.transition.mock.calls.map((c: any[]) => c[0].toStatus);
      expect(transitions).toContain('fraud');
      expect(rewardProcessor.processRewards).not.toHaveBeenCalled();
    });

    it('recovers a missed activation — advances through payment_verified before crediting', async () => {
      // Edge case: cron fires TRIAL_COMPLETED for a referral that's still
      // `pending` because the SUBSCRIPTION_ACTIVATED event was lost. The
      // handler must still advance the FSM correctly before crediting.
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-7',
        status: 'pending',
        referrer_studio_id: 'studio-A',
        referred_studio_id: 'studio-B',
        idempotency_key: null,
        referrer_studio: { id: 'studio-A', country: 'IN' },
        referred_studio: { id: 'studio-B', country: 'IN' },
      });

      await service.handleTrialCompleted(trialCompletedPayload('studio-B'));

      const transitions = lifecycle.transition.mock.calls.map((c: any[]) => c[0].toStatus);
      expect(transitions).toContain('subscribed');
      expect(transitions).toContain('payment_verified');
      expect(transitions).toContain('rewarded');
      expect(rewardProcessor.processRewards).toHaveBeenCalled();
    });
  });
});
