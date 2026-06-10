import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';

const log = new Logger('CronLock');

/**
 * Distributed cron lock backed by Redis `SET key value NX EX ttl`.
 *
 * Guarantees: at most one of N processes ever executes `fn` for a given
 * (key, time window). The TTL is the upper bound on how long another
 * process will wait before considering the lock abandoned — set it to a
 * comfortable multiple of the expected job duration.
 *
 * If Redis itself fails (network down, NOREPLICAS, etc.) we **skip the
 * run** rather than execute unguarded — running twice during a Redis
 * incident is exactly the failure mode this helper exists to prevent.
 *
 * Returns:
 *   - true  → the lock was acquired and `fn` completed (or threw — see below).
 *   - false → the lock was already held by another instance; nothing ran.
 *
 * Errors thrown by `fn` are re-raised after the lock is released.
 */
export async function withCronLock<T = void>(
  redis: Pick<Redis, 'set' | 'del'>,
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<{ ran: boolean; result?: T }> {
  const lockKey = `cron_lock:${key}`;
  const lockValue = `${process.pid}:${Date.now()}`;

  let acquired = false;
  try {
    const result = await redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
    acquired = result === 'OK';
  } catch (err) {
    log.warn(
      `Redis unavailable while acquiring lock "${key}" (${(err as Error).message}); skipping run to stay safe`,
    );
    return { ran: false };
  }

  if (!acquired) {
    log.debug(`Lock "${key}" held by another instance; skipping`);
    return { ran: false };
  }

  try {
    const result = await fn();
    return { ran: true, result };
  } finally {
    // Best-effort release. The TTL is the real safety net if del fails.
    try {
      await redis.del(lockKey);
    } catch (err) {
      log.warn(`Failed to release lock "${key}": ${(err as Error).message}`);
    }
  }
}
