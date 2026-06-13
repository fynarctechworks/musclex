import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';

/**
 * Distributed lock service using PostgreSQL advisory locks.
 * Ensures cron jobs only run on one instance in multi-replica deployments.
 * Uses pg_try_advisory_lock (non-blocking) — if another instance holds the lock,
 * the cron job simply skips execution on this instance.
 */
@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);

  constructor(private readonly pub: PublicPrismaService) {}

  /**
   * Attempt to acquire a session-level advisory lock.
   * Returns true if the lock was acquired, false if another instance holds it.
   * The lock key is derived from a string name via a hash to produce a stable bigint.
   */
  async tryAcquire(lockName: string): Promise<boolean> {
    const lockKey = this.hashLockName(lockName);
    try {
      const result = await this.pub.$queryRawUnsafe<Array<{ pg_try_advisory_lock: boolean }>>(
        `SELECT pg_try_advisory_lock($1)`,
        lockKey,
      );
      const acquired = result?.[0]?.pg_try_advisory_lock === true;
      if (!acquired) {
        this.logger.debug(`Cron lock "${lockName}" held by another instance, skipping`);
      }
      return acquired;
    } catch (error) {
      this.logger.error(`Failed to acquire cron lock "${lockName}": ${error.message}`);
      return false;
    }
  }

  /**
   * Release a session-level advisory lock.
   */
  async release(lockName: string): Promise<void> {
    const lockKey = this.hashLockName(lockName);
    try {
      await this.pub.$queryRawUnsafe(
        `SELECT pg_advisory_unlock($1)`,
        lockKey,
      );
    } catch (error) {
      this.logger.error(`Failed to release cron lock "${lockName}": ${error.message}`);
    }
  }

  /**
   * Execute a callback while holding a distributed lock.
   * If the lock cannot be acquired, returns null without executing.
   */
  async withLock<T>(lockName: string, callback: () => Promise<T>): Promise<T | null> {
    const acquired = await this.tryAcquire(lockName);
    if (!acquired) return null;
    try {
      return await callback();
    } finally {
      await this.release(lockName);
    }
  }

  /**
   * Hash a lock name to a 32-bit integer for pg_advisory_lock.
   * Uses FNV-1a hash algorithm for fast, well-distributed hashing.
   */
  private hashLockName(name: string): number {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < name.length; i++) {
      hash ^= name.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0; // FNV prime, keep as uint32
    }
    // pg_advisory_lock takes bigint; use positive 32-bit int
    return hash & 0x7fffffff;
  }
}
