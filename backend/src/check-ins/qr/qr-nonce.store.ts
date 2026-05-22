import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Replay-protection store for signed dynamic QR tokens.
 *
 * Each verified dynamic token has a `jti` (random 128-bit id). We mark
 * jti as "used" the first time it's verified and refuse to re-use it.
 * TTL is the token's remaining lifetime + small grace.
 *
 * Backed by Redis when available (multi-instance safe), with an in-memory
 * fallback for dev / single-instance environments. Falls back gracefully
 * if Redis is unreachable — the worst case is loss of replay protection
 * in that window, never a denial of legitimate check-ins.
 */
@Injectable()
export class QrNonceStore implements OnModuleDestroy {
  private readonly logger = new Logger(QrNonceStore.name);
  private redis: Redis | null = null;
  private memory = new Map<string, number>(); // jti → expiresAt (ms)

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    const enableRedis = this.config.get<string>('ENABLE_REDIS') === 'true';
    if (redisUrl && enableRedis) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableReadyCheck: true,
          retryStrategy: (times) => Math.min(times * 200, 3000),
          keyPrefix: '', // we use full keys, not prefixed
        });
        this.redis.connect().catch((err) => {
          this.logger.warn(`QrNonceStore Redis connect failed; using in-memory fallback: ${err.message}`);
          this.redis = null;
        });
      } catch (err) {
        this.logger.warn(
          `QrNonceStore Redis init failed; using in-memory fallback: ${err instanceof Error ? err.message : String(err)}`,
        );
        this.redis = null;
      }
    } else {
      this.logger.debug('QrNonceStore in-memory (REDIS_URL or ENABLE_REDIS not set)');
    }
  }

  /**
   * Atomically mark jti as used. Returns true if it was unused (first call),
   * false if a prior call already claimed it (replay).
   */
  async claim(jti: string, ttlSec: number): Promise<boolean> {
    const key = `qr_nonce:${jti}`;
    const ttlMs = Math.max(1000, ttlSec * 1000);

    if (this.redis) {
      try {
        // SET NX: only sets if not exists; returns 'OK' on first set, null if already present.
        const result = await this.redis.set(key, '1', 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch (err) {
        this.logger.warn(`Redis claim failed for ${jti}, falling back to memory: ${(err as Error).message}`);
        // Fall through to memory
      }
    }

    return this.claimInMemory(key, ttlMs);
  }

  private claimInMemory(key: string, ttlMs: number): boolean {
    const now = Date.now();
    const existing = this.memory.get(key);
    if (existing && existing > now) return false;
    this.memory.set(key, now + ttlMs);

    // Opportunistic cleanup so the memory map doesn't grow unbounded.
    if (this.memory.size > 1024) {
      for (const [k, exp] of this.memory) {
        if (exp <= now) this.memory.delete(k);
      }
    }
    return true;
  }

  async onModuleDestroy() {
    try {
      await this.redis?.quit();
    } catch {
      // ignore
    }
  }
}
