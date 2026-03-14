import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private redis: Redis | null = null;
  private fallbackStore = new Map<string, { totalHits: number; expiresAt: number }>();

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: true,
        retryStrategy: (times) => Math.min(times * 200, 3000),
      });
      this.redis.connect().catch((err) => {
        this.logger.warn(`Redis connection failed, falling back to in-memory: ${err.message}`);
        this.redis = null;
      });
    } else {
      this.logger.warn('REDIS_URL not configured — using in-memory rate limiting (not suitable for multi-instance)');
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redis) {
      return this.incrementInMemory(key, ttl, limit, blockDuration);
    }

    try {
      return await this.incrementRedis(key, ttl, limit, blockDuration);
    } catch {
      this.logger.warn('Redis increment failed, falling back to in-memory');
      return this.incrementInMemory(key, ttl, limit, blockDuration);
    }
  }

  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
    const blockKey = `${key}:blocked`;

    // Check if blocked
    const blockedTtl = await this.redis!.ttl(blockKey);
    if (blockedTtl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: ttlSeconds * 1000,
        isBlocked: true,
        timeToBlockExpire: blockedTtl * 1000,
      };
    }

    // Atomic increment + set TTL via Lua script
    const luaScript = `
      local current = redis.call('incr', KEYS[1])
      if current == 1 then
        redis.call('expire', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('ttl', KEYS[1])
      return {current, ttl}
    `;
    const result = (await this.redis!.eval(luaScript, 1, key, ttlSeconds)) as [number, number];
    const totalHits = result[0];
    const timeToExpire = result[1] * 1000;

    const isBlocked = totalHits > limit;
    if (isBlocked && blockDuration > 0) {
      await this.redis!.set(blockKey, '1', 'EX', Math.max(1, Math.ceil(blockDuration / 1000)));
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? blockDuration : 0,
    };
  }

  private incrementInMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const record = this.fallbackStore.get(key);

    // Periodic cleanup to prevent memory leaks
    if (this.fallbackStore.size > 10000) {
      for (const [k, v] of this.fallbackStore) {
        if (v.expiresAt < now) this.fallbackStore.delete(k);
      }
    }

    if (!record || record.expiresAt < now) {
      this.fallbackStore.set(key, { totalHits: 1, expiresAt: now + ttl });
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    record.totalHits++;
    const isBlocked = record.totalHits > limit;

    if (isBlocked && blockDuration > 0) {
      record.expiresAt = Math.max(record.expiresAt, now + blockDuration);
    }

    return {
      totalHits: record.totalHits,
      timeToExpire: record.expiresAt - now,
      isBlocked,
      timeToBlockExpire: isBlocked ? blockDuration : 0,
    };
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }
}
