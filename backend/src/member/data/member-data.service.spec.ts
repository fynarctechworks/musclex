import { MemberDataService } from './member-data.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Cross-member gate (Checklist §6) at the service layer: every member-owned
 * query MUST filter by the memberId from @CurrentMember. These tests capture
 * the Prisma `where` clauses and assert the authenticated member's id is always
 * applied — so Member A can never read/write Member B's rows within a gym.
 */
describe('MemberDataService — member scoping', () => {
  const memberA: CurrentMemberContext = { memberId: 'mA', tenantId: 'tA' };
  let prisma: any;
  let workouts: any;
  let service: MemberDataService;

  beforeEach(() => {
    workouts = { getTodaySummary: jest.fn().mockResolvedValue(null) };
    prisma = {
      member: { findFirst: jest.fn() },
      memberMembership: { findFirst: jest.fn() },
      memberInvoice: { findMany: jest.fn().mockResolvedValue([]) },
      memberBodyStats: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      memberProgressPhoto: { findMany: jest.fn().mockResolvedValue([]) },
      memberProfile: { findFirst: jest.fn() },
      branchSettings: { findFirst: jest.fn().mockResolvedValue(null) },
      checkIn: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      studio: { findUnique: jest.fn().mockResolvedValue({ name: 'Gym A' }) },
    };
    service = new MemberDataService(prisma, workouts);
  });

  it('getProfile queries only the authenticated member and maps the goal', async () => {
    prisma.member.findFirst.mockResolvedValue({
      id: 'mA',
      full_name: 'Ravi Kumar',
      phone: '919876543210',
      profile_photo_url: null,
      profile: { fitness_goal: 'muscle_gain' },
    });

    const profile = await service.getProfile(memberA);

    expect(prisma.member.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mA' } }),
    );
    expect(profile).toMatchObject({ id: 'mA', name: 'Ravi Kumar', goal: 'build_muscle' });
  });

  it('getMembership filters by member_id', async () => {
    prisma.memberMembership.findFirst.mockResolvedValue({
      status: 'active',
      end_date: new Date(Date.now() + 30 * 86_400_000),
      start_date: new Date(),
      auto_renew: false,
      plan: { id: 'p1', name: 'Gold', price: '1500', currency: 'INR' },
    });

    await service.getMembership(memberA);

    for (const call of prisma.memberMembership.findFirst.mock.calls) {
      expect(call[0].where.member_id).toBe('mA');
    }
    expect(prisma.memberInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { member_id: 'mA' } }),
    );
  });

  it('getProgress filters body stats and photos by member_id', async () => {
    await service.getProgress(memberA);
    expect(prisma.memberBodyStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { member_id: 'mA' } }),
    );
    expect(prisma.memberProgressPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { member_id: 'mA' } }),
    );
  });

  it('addMetric writes with the authenticated member_id + gym_id and computes BMI', async () => {
    prisma.memberProfile.findFirst.mockResolvedValue({ height: '170' });
    prisma.memberBodyStats.create.mockResolvedValue({
      id: 'bs1',
      weight: '70',
      bmi: '24.22',
      waist: null,
      recorded_at: new Date(),
    });

    await service.addMetric(memberA, { weightKg: 70 });

    const createArg = prisma.memberBodyStats.create.mock.calls[0][0];
    expect(createArg.data.member_id).toBe('mA');
    expect(createArg.data.gym_id).toBe('tA');
    expect(createArg.data.bmi).toBeCloseTo(24.22, 1);
  });

  it('throws NOT_FOUND (not another member) when the member row is absent', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.getProfile(memberA)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });
});
