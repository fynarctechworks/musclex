import { Test, TestingModule } from '@nestjs/testing';
import { RewardProcessorService } from '../../src/referrals/reward-processor.service';
import { RuleEngineService } from '../../src/referrals/rule-engine.service';
import { ReferralWalletService } from '../../src/referrals/referral-wallet.service';
import { SubscriptionPolicyService } from '../../src/common/services/subscription-policy.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Regression test for the bug Shiva Gym surfaced:
 *
 *   Shiva referred a gym → got +30 days reward → subscription_expires_at moved
 *   to Jun 19. But next_billing_date stayed at May 13, so the lifecycle compute
 *   (which only reads next_billing_date) still saw the gym as past-expiry in
 *   grace. The reward was cosmetic — Shiva still got locked tomorrow.
 *
 * Fix: applySubscriptionExtension now writes BOTH fields, and triggers a
 * lifecycle recompute so grace_period → active happens immediately.
 */
describe('RewardProcessorService.applySubscriptionExtension (apply path)', () => {
  let service: RewardProcessorService;
  let prisma: any;
  let subscriptionPolicy: { recomputeForStudio: jest.Mock };
  let ruleEngine: { checkPerReferrerCap: jest.Mock };

  const DAY = 24 * 60 * 60 * 1000;

  beforeEach(async () => {
    prisma = {
      rewardLog: {
        findUnique: jest.fn().mockResolvedValue(null), // no idempotency conflict
        create: jest.fn().mockResolvedValue({ id: 'log-new' }),
      },
      referralRewardRule: {
        findUnique: jest.fn().mockResolvedValue({ conditions: {} }), // no caps
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockImplementation((fn: any) =>
        typeof fn === 'function' ? fn(prisma) : Promise.all(fn),
      ),
    };
    ruleEngine = { checkPerReferrerCap: jest.fn().mockResolvedValue(true) };
    subscriptionPolicy = { recomputeForStudio: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardProcessorService,
        { provide: PrismaService, useValue: prisma },
        { provide: RuleEngineService, useValue: ruleEngine },
        { provide: ReferralWalletService, useValue: {} },
        { provide: SubscriptionPolicyService, useValue: subscriptionPolicy },
      ],
    }).compile();

    service = module.get(RewardProcessorService);
  });

  afterEach(() => jest.clearAllMocks());

  const callApply = () =>
    service.processRewards({
      referralId: 'ref-shiva',
      referrerStudioId: 'studio-shiva',
      matchedRules: [
        {
          id: 'rule-1',
          name: 'Default Referral Bonus',
          rewards: [{ type: 'extend_subscription', days: 30 }],
        },
      ],
      payload: {
        studioId: 'studio-referred',
        planId: 'enterprise',
        planName: 'enterprise',
        billingCycle: 'monthly',
        amountPaid: 4999,
        currency: 'INR',
        idempotencyKey: 'invoice-123',
        activatedAt: new Date(),
      },
      eventType: 'referral.subscription.activated',
    });

  it('extends BOTH subscription_expires_at AND next_billing_date by N days', async () => {
    // Shiva is in grace: next_billing was 7d ago, no separate expiry yet.
    const sevenDaysAgo = new Date(Date.now() - 7 * DAY);
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'studio-shiva',
        subscription_expires_at: null,
        next_billing_date: sevenDaysAgo,
      },
    ]);

    await callApply();

    // The $executeRaw call updates BOTH columns. Positional args are
    // [newExpiry, newBilling] in the tagged template.
    const [newExpiry, newBilling] = prisma.$executeRaw.mock.calls[0].slice(1);

    // Both bases were past, so apply path uses `now` as base → ~30d out.
    expect(Math.round((newExpiry.getTime() - Date.now()) / DAY)).toBe(30);
    expect(Math.round((newBilling.getTime() - Date.now()) / DAY)).toBe(30);
  });

  it('triggers lifecycle recompute so grace_period flips to active', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'studio-shiva',
        subscription_expires_at: null,
        next_billing_date: new Date(Date.now() - 7 * DAY),
      },
    ]);

    await callApply();
    await new Promise((r) => setImmediate(r)); // fire-and-forget settles

    expect(subscriptionPolicy.recomputeForStudio).toHaveBeenCalledWith('studio-shiva');
  });

  it('preserves continuity: a future expiry extends from THAT date, not now', async () => {
    // Gym already has a future expiry from prior referral — the new reward
    // stacks ON TOP of it, not replaces it.
    const inTenDays = new Date(Date.now() + 10 * DAY);
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'studio-shiva',
        subscription_expires_at: inTenDays,
        next_billing_date: inTenDays,
      },
    ]);

    await callApply();

    const [newExpiry, newBilling] = prisma.$executeRaw.mock.calls[0].slice(1);
    // 10d + 30d = 40d out, NOT 30d (which would mean we lost the prior 10d).
    expect(Math.round((newExpiry.getTime() - Date.now()) / DAY)).toBe(40);
    expect(Math.round((newBilling.getTime() - Date.now()) / DAY)).toBe(40);
  });

  it('writes the reward log with extended_from/to for audit', async () => {
    const future = new Date(Date.now() + 10 * DAY);
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'studio-shiva',
        subscription_expires_at: future,
        next_billing_date: future,
      },
    ]);

    await callApply();

    expect(prisma.rewardLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reward_type: 'extend_subscription',
          status: 'applied',
          subscription_extended_from: future,
          // extended_to is whatever the new date works out to — we already
          // verified the math above; here we just confirm the audit field is set.
          subscription_extended_to: expect.any(Date),
        }),
      }),
    );
  });
});
