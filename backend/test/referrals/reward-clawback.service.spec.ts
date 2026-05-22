import { Test, TestingModule } from '@nestjs/testing';
import { RewardProcessorService } from '../../src/referrals/reward-processor.service';
import { RuleEngineService } from '../../src/referrals/rule-engine.service';
import { ReferralWalletService } from '../../src/referrals/referral-wallet.service';
import { SubscriptionPolicyService } from '../../src/common/services/subscription-policy.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Unit tests for the referral reward CLAWBACK path (RewardProcessorService.reverseReward).
 *
 * When a referred gym cancels/refunds:
 *   • the referrer's earned days are subtracted back from BOTH
 *     subscription_expires_at AND next_billing_date (the field the lifecycle
 *     compute reads — without it, a clawback wouldn't actually re-lock anything).
 *   • the math never dips below `now` — we don't strip access the studio
 *     legitimately has from its own paid renewals.
 *   • the reward log is marked `reversed`.
 *   • SubscriptionPolicyService.recomputeForStudio is invoked after commit
 *     so the lifecycle status transitions immediately.
 *   • idempotency: an already-reversed log is a no-op.
 */
describe('RewardProcessorService.reverseReward (clawback)', () => {
  let service: RewardProcessorService;
  let prisma: any;
  let wallet: any;
  let subscriptionPolicy: { recomputeForStudio: jest.Mock };

  const DAY = 24 * 60 * 60 * 1000;

  beforeEach(async () => {
    // Minimal Prisma mock with a self-referencing $transaction (tx === prisma).
    // $queryRaw / $executeRaw handle the tagged-template SQL path used by the
    // service; the unsafe variants stay too for the wallet/legacy paths.
    prisma = {
      rewardLog: { update: jest.fn().mockResolvedValue({}) },
      referralWalletEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockImplementation((fn: any) =>
        typeof fn === 'function' ? fn(prisma) : Promise.all(fn),
      ),
    };
    wallet = { reverse: jest.fn().mockResolvedValue({}) };
    subscriptionPolicy = { recomputeForStudio: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardProcessorService,
        { provide: PrismaService, useValue: prisma },
        { provide: RuleEngineService, useValue: {} },
        { provide: ReferralWalletService, useValue: wallet },
        { provide: SubscriptionPolicyService, useValue: subscriptionPolicy },
      ],
    }).compile();

    service = module.get(RewardProcessorService);
  });

  afterEach(() => jest.clearAllMocks());

  // Helper: $executeRaw with tagged templates is called with (strings, ...values).
  // The clamped Date values appear as positional values — grab them by index
  // from the first call.
  const executeRawValues = () => prisma.$executeRaw.mock.calls[0].slice(1);

  it('subtracts the granted days from expiry AND next_billing_date', async () => {
    const futureExpiry = new Date(Date.now() + 40 * DAY);
    const futureBilling = new Date(Date.now() + 35 * DAY);
    prisma.$queryRaw.mockResolvedValue([
      {
        subscription_expires_at: futureExpiry,
        next_billing_date: futureBilling,
        trial_ends_at: null,
      },
    ]);

    await service.reverseReward({
      rewardLog: {
        id: 'log-1',
        referral_id: 'ref-1',
        beneficiary_studio_id: 'studio-A',
        reward_type: 'extend_subscription',
        reward_value: { days: 30 },
        status: 'applied',
        subscription_extended_from: null,
        subscription_extended_to: futureExpiry,
      },
      reason: 'referred gym cancelled',
    });

    const [newExpiry, newBilling] = executeRawValues();

    // expiry: 40d - 30d ≈ 10d out
    expect(Math.round((newExpiry.getTime() - Date.now()) / DAY)).toBe(10);
    // billing: 35d - 30d ≈ 5d out — pulled back the same delta, not snapped
    expect(Math.round((newBilling.getTime() - Date.now()) / DAY)).toBe(5);

    expect(prisma.rewardLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: expect.objectContaining({ status: 'reversed' }),
      }),
    );
  });

  it('never claws back below now (referrer paid their own way since)', async () => {
    const soonExpiry = new Date(Date.now() + 5 * DAY);
    const soonBilling = new Date(Date.now() + 3 * DAY);
    prisma.$queryRaw.mockResolvedValue([
      {
        subscription_expires_at: soonExpiry,
        next_billing_date: soonBilling,
        trial_ends_at: null,
      },
    ]);

    await service.reverseReward({
      rewardLog: {
        id: 'log-2',
        referral_id: 'ref-2',
        beneficiary_studio_id: 'studio-A',
        reward_type: 'extend_subscription',
        reward_value: { days: 30 },
        status: 'applied',
        subscription_extended_from: null,
        subscription_extended_to: soonExpiry,
      },
      reason: 'refund',
    });

    const [newExpiry, newBilling] = executeRawValues();
    // Both clamped to ~now (within a second), not 25/27 days in the past.
    expect(Math.abs(newExpiry.getTime() - Date.now())).toBeLessThan(2000);
    expect(Math.abs(newBilling.getTime() - Date.now())).toBeLessThan(2000);
  });

  it('triggers a lifecycle recompute after a clawback (so locks reapply)', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        subscription_expires_at: new Date(Date.now() + 40 * DAY),
        next_billing_date: new Date(Date.now() + 40 * DAY),
        trial_ends_at: null,
      },
    ]);

    await service.reverseReward({
      rewardLog: {
        id: 'log-recompute',
        referral_id: 'ref-r',
        beneficiary_studio_id: 'studio-A',
        reward_type: 'extend_subscription',
        reward_value: { days: 30 },
        status: 'applied',
        subscription_extended_from: null,
        subscription_extended_to: null,
      },
      reason: 'refund',
    });

    // Allow the fire-and-forget .catch() chain to settle.
    await new Promise((r) => setImmediate(r));
    expect(subscriptionPolicy.recomputeForStudio).toHaveBeenCalledWith('studio-A');
  });

  it('is idempotent — an already-reversed log is a no-op', async () => {
    await service.reverseReward({
      rewardLog: {
        id: 'log-3',
        referral_id: 'ref-3',
        beneficiary_studio_id: 'studio-A',
        reward_type: 'extend_subscription',
        reward_value: { days: 30 },
        status: 'reversed',
        subscription_extended_from: null,
        subscription_extended_to: null,
      },
      reason: 'replay',
    });

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.rewardLog.update).not.toHaveBeenCalled();
    expect(subscriptionPolicy.recomputeForStudio).not.toHaveBeenCalled();
  });

  it('reverses a wallet_credit via the wallet ledger (no lifecycle recompute)', async () => {
    prisma.referralWalletEntry.findFirst.mockResolvedValue({ id: 'entry-9' });

    await service.reverseReward({
      rewardLog: {
        id: 'log-4',
        referral_id: 'ref-4',
        beneficiary_studio_id: 'studio-A',
        reward_type: 'wallet_credit',
        reward_value: { amount: 500, currency: 'INR' },
        status: 'applied',
        subscription_extended_from: null,
        subscription_extended_to: null,
      },
      reason: 'referred gym refunded',
    });

    expect(wallet.reverse).toHaveBeenCalledWith(
      expect.objectContaining({ originalEntryId: 'entry-9', idempotencyKey: 'clawback_log-4' }),
    );
    expect(prisma.rewardLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'reversed' }) }),
    );
    // Wallet credit reversals don't affect lifecycle, so no recompute.
    expect(subscriptionPolicy.recomputeForStudio).not.toHaveBeenCalled();
  });
});
