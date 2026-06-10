import { ErrorRetentionService } from './error-retention.service';

function makeService(envDays?: string) {
  const prev = process.env.ERROR_OCCURRENCE_RETENTION_DAYS;
  if (envDays === undefined) delete process.env.ERROR_OCCURRENCE_RETENTION_DAYS;
  else process.env.ERROR_OCCURRENCE_RETENTION_DAYS = envDays;

  const prisma = {
    errorOccurrence: { deleteMany: jest.fn(async () => ({ count: 3 })) },
  } as any;
  const redis = { set: jest.fn(), del: jest.fn() } as any;
  const svc = new ErrorRetentionService(prisma, redis);

  if (prev === undefined) delete process.env.ERROR_OCCURRENCE_RETENTION_DAYS;
  else process.env.ERROR_OCCURRENCE_RETENTION_DAYS = prev;

  return { svc, prisma };
}

describe('ErrorRetentionService.run', () => {
  it('deletes occurrences older than the default 90-day window', async () => {
    const { svc, prisma } = makeService(undefined);
    await svc.run();
    const where = prisma.errorOccurrence.deleteMany.mock.calls[0][0].where;
    const cutoff: Date = where.occurred_at.lt;
    const ageDays = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThan(89);
    expect(ageDays).toBeLessThan(91);
  });

  it('honors ERROR_OCCURRENCE_RETENTION_DAYS', async () => {
    const { svc, prisma } = makeService('7');
    await svc.run();
    const cutoff: Date = prisma.errorOccurrence.deleteMany.mock.calls[0][0].where.occurred_at.lt;
    const ageDays = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThan(6);
    expect(ageDays).toBeLessThan(8);
  });

  it('falls back to 90 days when the env value is invalid', async () => {
    const { svc, prisma } = makeService('not-a-number');
    await svc.run();
    const cutoff: Date = prisma.errorOccurrence.deleteMany.mock.calls[0][0].where.occurred_at.lt;
    const ageDays = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThan(89);
    expect(ageDays).toBeLessThan(91);
  });
});
