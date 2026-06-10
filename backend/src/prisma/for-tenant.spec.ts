import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Unit contract for PrismaService.forTenant (Phase B keystone, runbook §3).
 *
 * No live DB: we stub `$transaction` to capture the transaction client the
 * helper builds, and assert that BEFORE running the caller's work it sets the
 * tenant GUC transaction-locally (`set_config('app.gym_id', <gymId>, true)`).
 * This is the property the cutover depends on — get it wrong and queries run
 * under the wrong (or a leaked) gym once the role stops bypassing RLS.
 */
describe('PrismaService.forTenant', () => {
  function makeService() {
    // Construct without invoking the real PrismaClient constructor / $use wiring.
    const svc = Object.create(PrismaService.prototype) as PrismaService;
    const calls: { gqlTag: TemplateStringsArray; values: unknown[] }[] = [];

    const tx = {
      $queryRaw: (gqlTag: TemplateStringsArray, ...values: unknown[]) => {
        calls.push({ gqlTag, values });
        return Promise.resolve([{ set_config: values[0] }]);
      },
    };

    // Stub $transaction to behave like Prisma's interactive transaction:
    // call the callback with our fake tx client and return its result.
    (svc as any).$transaction = (cb: (t: any) => Promise<unknown>) => cb(tx);

    return { svc, calls };
  }

  it('sets app.gym_id transaction-locally before running the work', async () => {
    const { svc, calls } = makeService();
    const GYM = '11111111-1111-1111-1111-111111111111';

    let ranAfterGucSet = false;
    const result = await svc.forTenant(GYM, async (tx) => {
      // The GUC must already be set by the time the work runs.
      expect(calls).toHaveLength(1);
      ranAfterGucSet = true;
      return 42;
    });

    expect(result).toBe(42);
    expect(ranAfterGucSet).toBe(true);

    // Exactly one set_config call. The gym id is the ONLY interpolated value
    // (parameterized → injection-safe); the tx-local `true` flag is literal SQL.
    expect(calls).toHaveLength(1);
    const sql = calls[0].gqlTag.join('?');
    expect(sql).toContain("set_config('app.gym_id'");
    expect(sql).toContain(', true)'); // transaction-local (auto-resets on commit)
    expect(calls[0].values).toEqual([GYM]); // exactly one bound param: the gym id
  });

  it('refuses to run without a gym_id (fail-closed)', async () => {
    const { svc, calls } = makeService();
    const work = jest.fn();

    await expect(svc.forTenant('', work as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(work).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it('propagates the work result and does not swallow errors', async () => {
    const { svc } = makeService();
    const GYM = '22222222-2222-2222-2222-222222222222';

    await expect(
      svc.forTenant(GYM, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
