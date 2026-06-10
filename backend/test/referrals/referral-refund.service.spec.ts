import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReferralsService } from '../../src/referrals/referrals.service';
import { RuleEngineService } from '../../src/referrals/rule-engine.service';
import { RewardProcessorService } from '../../src/referrals/reward-processor.service';
import { ReferralLifecycleService } from '../../src/referrals/referral-lifecycle.service';
import { ReferralFraudService } from '../../src/referrals/referral-fraud.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SubscriptionRefundedPayload } from '../../src/referrals/events/domain-events';

/**
 * Unit tests for the B2B referral CLAWBACK orchestration
 * (ReferralsService.handleSubscriptionRefunded) — the fix for the
 * "refer a gym, get rewarded, then the referred gym cancels" fraud.
 */
describe('ReferralsService.handleSubscriptionRefunded', () => {
  let service: ReferralsService;
  let prisma: any;
  let rewardProcessor: any;
  let lifecycle: any;

  const payload = (studioId: string): SubscriptionRefundedPayload => ({
    studioId,
    originalIdempotencyKey: '',
    refundReason: 'cancelled',
    refundedAt: new Date(),
  });

  beforeEach(async () => {
    prisma = {
      referral: { findUnique: jest.fn() },
      rewardLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    rewardProcessor = { reverseReward: jest.fn().mockResolvedValue(undefined) };
    lifecycle = { transition: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RuleEngineService, useValue: {} },
        { provide: RewardProcessorService, useValue: rewardProcessor },
        { provide: ReferralLifecycleService, useValue: lifecycle },
        { provide: ReferralFraudService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReferralsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('does nothing when the refunded studio was never referred', async () => {
    prisma.referral.findUnique.mockResolvedValue(null);

    await service.handleSubscriptionRefunded(payload('studio-X'));

    expect(rewardProcessor.reverseReward).not.toHaveBeenCalled();
    expect(lifecycle.transition).not.toHaveBeenCalled();
  });

  it('reverses every applied reward log and marks the referral reversed when rewarded', async () => {
    prisma.referral.findUnique.mockResolvedValue({
      id: 'ref-1',
      status: 'rewarded',
      referrer_studio_id: 'studio-A',
    });
    prisma.rewardLog.findMany.mockResolvedValue([
      { id: 'log-1', reward_type: 'extend_subscription', reward_value: { days: 30 }, status: 'applied' },
      { id: 'log-2', reward_type: 'wallet_credit', reward_value: { amount: 500 }, status: 'applied' },
    ]);

    await service.handleSubscriptionRefunded(payload('studio-B'));

    expect(rewardProcessor.reverseReward).toHaveBeenCalledTimes(2);
    expect(lifecycle.transition).toHaveBeenCalledWith(
      expect.objectContaining({ referralId: 'ref-1', toStatus: 'reversed' }),
    );
  });

  it('is idempotent — an already-reversed referral is skipped', async () => {
    prisma.referral.findUnique.mockResolvedValue({
      id: 'ref-2',
      status: 'reversed',
      referrer_studio_id: 'studio-A',
    });

    await service.handleSubscriptionRefunded(payload('studio-B'));

    expect(rewardProcessor.reverseReward).not.toHaveBeenCalled();
    expect(lifecycle.transition).not.toHaveBeenCalled();
  });

  it('reverses a pending referral pre-reward (cancel before paying) without touching reward logs', async () => {
    prisma.referral.findUnique.mockResolvedValue({
      id: 'ref-3',
      status: 'pending',
      referrer_studio_id: 'studio-A',
    });

    await service.handleSubscriptionRefunded(payload('studio-B'));

    // No applied reward to reverse, but we still close the referral so a late
    // reward can never land.
    expect(rewardProcessor.reverseReward).not.toHaveBeenCalled();
    expect(lifecycle.transition).toHaveBeenCalledWith(
      expect.objectContaining({ referralId: 'ref-3', toStatus: 'reversed' }),
    );
  });
});
