import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Shared Redis-backed cache for dashboard read-models.
 *
 * Replaces the previous in-process `cache: Map` (formerly local to
 * dashboard-pulse.service.ts). Future Pulse / Tile services should call
 * `wrap(key, ttl, loader)` to ensure all dashboard reads share one cache
 * pool that scales horizontally on Upstash Redis.
 *
 * Key shape is preserved verbatim so caller code does not need to change:
 *   `dashboard:pulse:{branch_id}` (30s TTL)
 *   `dashboard:tile:{tile_id}:{branch_id}:{filter_hash}` etc.
 *
 * If REDIS_URL is missing or the connection fails the service falls back to
 * an in-memory Map with the same TTL semantics so dev/test environments
 * keep working unchanged.
 */
@Injectable()
export class DashboardCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(DashboardCacheService.name);
  private redis: Redis | null = null;
  private readonly memoryCache = new Map<string, { value: string; expiresAt: number }>();
  private readonly DEFAULT_TTL_MS = 30_000;

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
        });
        this.redis.connect().catch((err) => {
          this.logger.warn(
            `DashboardCache Redis connection failed, using in-memory fallback: ${err.message}`,
          );
          this.redis = null;
        });
      } catch (err) {
        this.logger.warn(
          `DashboardCache Redis init failed, using in-memory fallback: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        this.redis = null;
      }
    } else {
      this.logger.debug('DashboardCache running in-memory (REDIS_URL not configured)');
    }
  }

  /**
   * Read a cached value, or compute + store via the loader.
   * @param key   Stable cache key (e.g. `dashboard:pulse:branch-123`).
   * @param ttlMs TTL in milliseconds (defaults to 30s — matches the legacy in-process cache).
   * @param loader Async function executed only on miss.
   */
  async wrap<T>(key: string, ttlMs: number = this.DEFAULT_TTL_MS, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    await this.set(key, value, ttlMs);
    return value;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw == null) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        this.logger.warn(
          `Redis GET failed for ${key}, falling back to memory: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        // Fall through to memory.
      }
    }
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number = this.DEFAULT_TTL_MS): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.redis) {
      try {
        await this.redis.set(key, serialized, 'PX', Math.max(1, ttlMs));
        return;
      } catch (err) {
        this.logger.warn(
          `Redis SET failed for ${key}, falling back to memory: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    // Fallback / parallel-store in memory.
    this.memoryCache.set(key, { value: serialized, expiresAt: Date.now() + ttlMs });
    // Periodic cleanup to prevent unbounded growth.
    if (this.memoryCache.size > 5000) {
      const now = Date.now();
      for (const [k, v] of this.memoryCache) {
        if (v.expiresAt < now) this.memoryCache.delete(k);
      }
    }
  }

  async invalidate(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (err) {
        this.logger.warn(
          `Redis DEL failed for ${key}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.memoryCache.delete(key);
  }

  /** Builds the legacy pulse cache key — kept identical to the previous in-process Map shape. */
  static pulseKey(branchId?: string | null): string {
    return `dashboard:pulse:${branchId ?? 'all'}`;
  }

  /**
   * Health probe for the system-status tile. Returns a single source of
   * truth for "is Redis reachable" — `SystemStatusService` delegates here
   * instead of opening its own ioredis connection.
   */
  async getRedisHealth(): Promise<{
    healthy: boolean;
    latency_ms?: number;
    message?: string;
  }> {
    if (!this.redis) {
      return { healthy: false, message: 'Redis not configured (using in-memory fallback)' };
    }
    const start = Date.now();
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return { healthy: false, message: `unexpected response: ${pong}` };
      }
      return { healthy: true, latency_ms: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis?.quit();
    } catch {
      // ignore — we're tearing down
    }
  }
}
