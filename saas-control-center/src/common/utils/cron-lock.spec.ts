import { withCronLock } from './cron-lock';

function makeRedis(opts: { setResult?: 'OK' | null; setThrows?: Error } = {}) {
  const hasResult = Object.prototype.hasOwnProperty.call(opts, 'setResult');
  return {
    set: jest.fn(async () => {
      if (opts.setThrows) throw opts.setThrows;
      return hasResult ? opts.setResult : 'OK';
    }),
    del: jest.fn(async () => 1),
  } as any;
}

describe('withCronLock', () => {
  it('runs the body and releases the lock when SET NX returns OK', async () => {
    const redis = makeRedis({ setResult: 'OK' });
    const body = jest.fn(async () => 42);

    const out = await withCronLock(redis, 'job-a', 60, body);

    expect(out).toEqual({ ran: true, result: 42 });
    expect(redis.set).toHaveBeenCalledWith(
      'cron_lock:job-a',
      expect.any(String),
      'EX', 60, 'NX',
    );
    expect(body).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith('cron_lock:job-a');
  });

  it('skips when SET NX returns null (lock already held)', async () => {
    const redis = makeRedis({ setResult: null });
    const body = jest.fn(async () => 'should not run');

    const out = await withCronLock(redis, 'job-b', 30, body);

    expect(out).toEqual({ ran: false });
    expect(body).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('skips (does NOT run unguarded) when Redis throws', async () => {
    const redis = makeRedis({ setThrows: new Error('ECONNREFUSED') });
    const body = jest.fn();

    const out = await withCronLock(redis, 'job-c', 60, body);

    expect(out).toEqual({ ran: false });
    expect(body).not.toHaveBeenCalled();
  });

  it('releases the lock even if the body throws', async () => {
    const redis = makeRedis({ setResult: 'OK' });
    const body = jest.fn(async () => { throw new Error('boom'); });

    await expect(withCronLock(redis, 'job-d', 60, body)).rejects.toThrow('boom');
    expect(redis.del).toHaveBeenCalledWith('cron_lock:job-d');
  });
});
