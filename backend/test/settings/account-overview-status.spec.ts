import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from '../../src/settings/settings.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { QueueService } from '../../src/queue/queue.service';
import { SccSyncService } from '../../src/common/services/scc-sync.service';
import { SubscriptionPolicyService } from '../../src/common/services/subscription-policy.service';

/**
 * Regression test for the Settings → Subscription status chip.
 *
 * Bug: the chip read studio.subscription_status (a legacy column frozen at
 * 'active' from onboarding), so a gym in grace/locked still showed "Active"
 * while the lock banner correctly said "expired". The fix wires the chip to
 * the LIVE-computed lifecycle status from SubscriptionPolicyService.getContext.
 */
describe('SettingsService.getAccountOverview — subscription status', () => {
  let service: SettingsService;
  let prisma: any;
  let policy: { getContext: jest.Mock };

  beforeEach(async () => {
    prisma = {
      studio: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'studio-1',
          subscription_plan: 'enterprise',
          subscription_status: 'active', // ← stale legacy column
          billing_cycle: 'monthly',
          subscription_start: new Date('2026-04-13'),
          next_billing_date: new Date('2026-05-13'),
          trial_ends_at: null,
          currency: 'INR',
          invoices: [],
        }),
      },
      branch: { count: jest.fn().mockResolvedValue(2) },
      member: { count: jest.fn().mockResolvedValue(8) },
      staff: { count: jest.fn().mockResolvedValue(1) },
    };

    policy = {
      // Live truth: the studio is past expiry and in grace.
      getContext: jest.fn().mockResolvedValue({
        status: 'grace_period',
        plan: 'enterprise',
        billing_cycle: 'monthly',
        expires_at: '2026-05-13T00:00:00.000Z',
        grace_until: '2026-05-21T00:00:00.000Z',
        locked_at: null,
        days_until_expiry: 0,
        grace_days_remaining: 1,
        can_mutate: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: {} },
        { provide: SccSyncService, useValue: {} },
        { provide: SubscriptionPolicyService, useValue: policy },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the computed lifecycle status, not the stale subscription_status', async () => {
    const result = await service.getAccountOverview('studio-1');

    // The chip must reflect reality (grace_period), NOT the frozen 'active'.
    expect(result.subscription.status).toBe('grace_period');
    expect(result.subscription.status).not.toBe('active');
    expect(policy.getContext).toHaveBeenCalledWith('studio-1');
  });

  it('surfaces grace/lock context so the UI can mirror the banner', async () => {
    const result = await service.getAccountOverview('studio-1');

    expect(result.subscription.grace_days_remaining).toBe(1);
    expect(result.subscription.can_mutate).toBe(false);
    expect(result.subscription.grace_until).toBe('2026-05-21T00:00:00.000Z');
  });
});
