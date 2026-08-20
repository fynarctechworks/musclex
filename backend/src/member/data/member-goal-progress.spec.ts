import { MemberPublicHealthService } from './member-public-health.service';

/**
 * Goal progress.
 *
 * `current_value` was only ever written when a member typed it, so a steps or
 * water goal read "0 / 8000" forever however much they actually did. That is
 * worse than having no goal, because it tells them they have done nothing.
 */
describe('MemberPublicHealthService.listGoals — progress', () => {
  const ME = 'me';
  let pub: any;
  let service: MemberPublicHealthService;

  const goal = (type: string, over: Record<string, unknown> = {}) => ({
    id: `g-${type}`,
    type,
    title: `${type} goal`,
    target_value: 8000,
    current_value: 0,
    unit: type,
    target_date: null,
    status: 'active',
    ...over,
  });

  beforeEach(() => {
    pub = {
      appUserGoal: { findMany: jest.fn().mockResolvedValue([]) },
      appUserHealthDaily: { findFirst: jest.fn().mockResolvedValue(null) },
      appUserWaterLog: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount_ml: null } }) },
      appUserWeightLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new MemberPublicHealthService(pub as any);
  });

  it('fills a steps goal from today\'s step count', async () => {
    pub.appUserGoal.findMany.mockResolvedValue([goal('steps')]);
    pub.appUserHealthDaily.findFirst.mockResolvedValue({ steps: 6482 });
    const out = await service.listGoals(ME);
    expect(out.goals[0].currentValue).toBe(6482);
  });

  it('fills a water goal from today\'s total', async () => {
    pub.appUserGoal.findMany.mockResolvedValue([goal('water')]);
    pub.appUserWaterLog.aggregate.mockResolvedValue({ _sum: { amount_ml: 1750 } });
    const out = await service.listGoals(ME);
    expect(out.goals[0].currentValue).toBe(1750);
  });

  it('uses the latest weight, not a running total', async () => {
    // A weight goal is about where you are now, not how far you have moved.
    pub.appUserGoal.findMany.mockResolvedValue([goal('weight')]);
    pub.appUserWeightLog.findFirst.mockResolvedValue({ weight_kg: 74.5 });
    const out = await service.listGoals(ME);
    expect(out.goals[0].currentValue).toBe(74.5);
  });

  it('reports 0 for a daily goal with nothing logged today, not yesterday\'s number', async () => {
    pub.appUserGoal.findMany.mockResolvedValue([goal('steps')]);
    const out = await service.listGoals(ME);
    expect(out.goals[0].currentValue).toBe(0);
  });

  it('keeps the stored value for a type nothing computes yet', async () => {
    // A manually tracked goal must not be zeroed by this.
    pub.appUserGoal.findMany.mockResolvedValue([goal('custom', { current_value: 12 })]);
    const out = await service.listGoals(ME);
    expect(out.goals[0].currentValue).toBe(12);
  });

  it('leaves a finished goal exactly as it was', async () => {
    // Its final number is history; recomputing would rewrite it to today's.
    pub.appUserGoal.findMany.mockResolvedValue([
      goal('steps', { status: 'completed', current_value: 8200 }),
    ]);
    pub.appUserHealthDaily.findFirst.mockResolvedValue({ steps: 12 });
    const out = await service.listGoals(ME);
    expect(out.goals[0].currentValue).toBe(8200);
  });

  it('queries nothing extra when no active goal needs it', async () => {
    pub.appUserGoal.findMany.mockResolvedValue([goal('custom')]);
    await service.listGoals(ME);
    expect(pub.appUserHealthDaily.findFirst).not.toHaveBeenCalled();
    expect(pub.appUserWaterLog.aggregate).not.toHaveBeenCalled();
    expect(pub.appUserWeightLog.findFirst).not.toHaveBeenCalled();
  });

  it('does no work at all with no goals', async () => {
    expect(await service.listGoals(ME)).toEqual({ goals: [] });
  });
});
