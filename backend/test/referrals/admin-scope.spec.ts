import { ForbiddenException } from '@nestjs/common';

import { ReferralsAdminController } from '../../src/referrals/referrals-admin.controller';

/**
 * `/admin/referrals/*` is declared @Roles('owner','super_admin'), so a GYM owner
 * reaches every handler on it. Most of those handlers read or write the
 * PLATFORM's referral programme — every gym's referrals, names, fraud queue and
 * reward rules — none of which is scoped by gym.
 *
 * Demonstrated against the running API before this was fixed: the owner of
 * "MuscleX Test Gym" called GET /admin/referrals/analytics and got back
 * `top_referrers: [{ studio: { name: "Iron Temple Fitness", referral_code:
 * "A234AC" } }]` — a gym they have no relationship with.
 *
 * The one deliberate exception is reading reward RULES: those are the offer we
 * publish to gyms, and the gym-facing settings page renders them.
 */
describe('referrals admin scope', () => {
  const OWNER = {
    user_id: 'u-1',
    studio_id: 'gym-a',
    role: 'owner',
    roles: [{ role_name: 'owner' }],
  } as any;
  const PLATFORM = {
    user_id: 'u-2',
    studio_id: 'gym-a',
    role: 'super_admin',
    roles: [{ role_name: 'super_admin' }],
  } as any;
  /** A gym owner whose secondary role list is where super_admin would appear. */
  const PLATFORM_VIA_ROLES = {
    user_id: 'u-3',
    studio_id: 'gym-a',
    role: 'owner',
    roles: [{ role_name: 'owner' }, { role_name: 'super_admin' }],
  } as any;

  function makeController() {
    const prisma = {
      referralCampaign: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      referralRewardRule: { findMany: jest.fn().mockResolvedValue([]) },
      referral: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      rewardLog: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      studio: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const admin = {
      getOverview: jest.fn().mockResolvedValue({}),
      listFraudQueue: jest.fn().mockResolvedValue({ items: [] }),
      reviewFraudSignal: jest.fn(),
      forceTransition: jest.fn(),
      revokeReward: jest.fn(),
      recomputeRiskScore: jest.fn(),
    };
    const referralsService = { listReferrals: jest.fn().mockResolvedValue({ data: [] }) };
    const lifecycle = { getHistory: jest.fn().mockResolvedValue([]) };
    const controller = new ReferralsAdminController(
      prisma as any,
      referralsService as any,
      admin as any,
      {} as any,
      lifecycle as any,
    );
    return { controller, prisma, admin, referralsService, lifecycle };
  }

  const ID = '00000000-0000-4000-8000-000000000001';

  /** [name, call] — every handler that must be platform-admin only. */
  function platformOnlyCalls(c: ReferralsAdminController): Array<[string, (u: any) => unknown]> {
    return [
      ['GET analytics',              (u) => c.getAnalytics(u)],
      ['GET / (all referrals)',      (u) => c.listAllReferrals(u)],
      ['GET overview',               (u) => c.getOverview(u)],
      ['GET fraud-queue',            (u) => c.listFraudQueue(u, {} as any)],
      ['GET campaigns',              (u) => c.listCampaigns(u)],
      ['POST campaigns',             (u) => c.createCampaign(u, { name: 'x' } as any)],
      ['PATCH campaigns/:id',        (u) => c.updateCampaign(u, ID, {} as any)],
      ['GET :id/lifecycle',          (u) => c.getLifecycle(u, ID)],
      ['POST :id/force-transition',  (u) => c.forceTransition(ID, { to_status: 'rewarded', reason: 'r' } as any, u)],
      ['POST reward-logs/:id/revoke',(u) => c.revokeReward(ID, { reason: 'r' } as any, u)],
      ['POST fraud-signals/:id/review', (u) => c.reviewSignal(ID, { decision: 'clear' } as any, u)],
      ['POST :id/recompute-risk',    (u) => c.recomputeRisk(u, ID)],
    ];
  }

  /*
   * Some handlers are async and some are not. Routing every call through
   * Promise.resolve().then(...) normalises both, and — more importantly —
   * stops an async handler's rejection from escaping as an unhandled promise,
   * which crashes the worker instead of failing the assertion.
   */
  const invoke = (call: (u: any) => unknown, user: any) => Promise.resolve().then(() => call(user));

  const NAMES = platformOnlyCalls(makeController().controller).map(([name]) => name);

  it.each(NAMES)('refuses a gym owner: %s', async (name) => {
    const { controller } = makeController();
    const call = platformOnlyCalls(controller).find(([n]) => n === name)![1];
    await expect(invoke(call, OWNER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(NAMES)('still allows a platform admin: %s', async (name) => {
    const { controller } = makeController();
    const call = platformOnlyCalls(controller).find(([n]) => n === name)![1];
    await expect(invoke(call, PLATFORM)).resolves.not.toThrow();
  });

  it('recognises super_admin in the roles list, not just the primary role', async () => {
    const { controller } = makeController();
    await expect(invoke((u) => controller.getAnalytics(u), PLATFORM_VIA_ROLES)).resolves.not.toThrow();
  });

  it('still lets a gym owner read reward RULES — they are our published offer', async () => {
    const { controller, prisma } = makeController();
    await expect(invoke(() => controller.listRules(), OWNER)).resolves.not.toThrow();
    expect(prisma.referralRewardRule.findMany).toHaveBeenCalled();
  });
});
