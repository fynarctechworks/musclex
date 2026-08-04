import { TrainerService } from '../../src/staff/trainer.service';

/**
 * PT session pricing.
 *
 * `const sessionRate = 500` was hardcoded in completeSession, so every
 * TrainerRevenue row — and therefore every commission and payroll figure in
 * the product — was priced at ₹500 regardless of what the gym actually
 * charges. The numbers were internally consistent and completely wrong.
 *
 * The rate now comes from PayrollConfig.bonus_structure.session_rate.
 */
describe('TrainerService — PT session rate', () => {
  const SESSION = {
    id: 's-1',
    trainer_id: 't-1',
    branch_id: 'b-1',
    revenue: null,
    // updateSession gates on the session's trainer belonging to the studio.
    trainer: { id: 't-1', organization_id: 'studio-1' },
  };

  const build = (bonusStructure: unknown, commissionPct = 10) => {
    const recordRevenue = jest.fn().mockResolvedValue(undefined);
    const client = {
      trainerSession: {
        findUnique: jest.fn().mockResolvedValue(SESSION),
        findFirst: jest.fn().mockResolvedValue(SESSION),
        update: jest.fn().mockResolvedValue({ ...SESSION, status: 'completed' }),
      },
      payrollConfig: {
        findUnique: jest.fn().mockResolvedValue({
          commission_percentage: commissionPct,
          bonus_structure: bonusStructure,
        }),
      },
    };
    const service = new TrainerService({ client } as unknown as never, {
      recordRevenue,
    } as unknown as never);
    return { service, recordRevenue, client };
  };

  /** resolveSessionRate is private; exercise it directly by name. */
  const rateOf = (service: TrainerService, bonus: unknown) =>
    (service as unknown as {
      resolveSessionRate(b: unknown, id: string): number;
    }).resolveSessionRate(bonus, 't-1');

  it('uses the gym-configured session rate', () => {
    const { service } = build({ session_rate: 1200 });
    expect(rateOf(service, { session_rate: 1200 })).toBe(1200);
  });

  it('accepts a numeric string, as JSON config often supplies', () => {
    const { service } = build({ session_rate: '1500' });
    expect(rateOf(service, { session_rate: '1500' })).toBe(1500);
  });

  it('falls back to the platform default when unset', () => {
    const { service } = build({});
    expect(rateOf(service, {})).toBe(500);
    expect(rateOf(service, null)).toBe(500);
    expect(rateOf(service, undefined)).toBe(500);
  });

  it('rejects junk rather than pricing sessions at NaN or zero', () => {
    const { service } = build({});
    // A NaN rate would silently write NaN revenue; 0 or negative would zero
    // out or invert every commission.
    expect(rateOf(service, { session_rate: 'abc' })).toBe(500);
    expect(rateOf(service, { session_rate: 0 })).toBe(500);
    expect(rateOf(service, { session_rate: -100 })).toBe(500);
  });

  it('prices commission off the configured rate, not the constant', async () => {
    const { service, recordRevenue } = build({ session_rate: 2000 }, 15);

    await service.updateSession('studio-1', 's-1', { status: 'completed' } as never);

    expect(recordRevenue).toHaveBeenCalledWith(
      expect.objectContaining({
        revenue_amount: 2000,
        commission_amount: 300, // 15% of 2000, not 15% of 500
      }),
    );
  });
});
