import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { CheckInContext, CheckInRule, RuleResult } from '../rule.interface';

/**
 * Per-member cooldown — defeats rapid-fire scanning attacks and turnstile
 * mash-presses. Distinct from the same-day DuplicateRule: this is a
 * SECONDS-scale window. Once a member checks in, they cannot check in
 * again for `CHECKIN_COOLDOWN_SECONDS` (default 30s).
 *
 * Order 65 places it between class-credits (60) and duplicate (70) so a
 * cooldown failure takes precedence over the "you already checked in
 * today" message — the operator gets a more actionable error.
 *
 * Implementation:
 *   - Redis SET NX with PX TTL — atomic, safe across multiple API instances.
 *   - In-memory fallback for dev / single-instance.
 *   - SOFT enforcement: 'overridable' severity, so staff with the override
 *     permission can bypass for legitimate edge cases (member walked back
 *     in for a forgotten phone, etc).
 *
 * Disable by setting CHECKIN_COOLDOWN_SECONDS=0.
 */
@Injectable()
export class CooldownRule implements CheckInRule, OnModuleDestroy {
  readonly code = 'cooldown';
  readonly order = 65;

  private readonly logger = new Logger(CooldownRule.name);
  private readonly ttlSec: number;
  private redis: Redis | null = null;
  private readonly memory = new Map<string, number>(); // key → expiresAt (ms)

  constructor(private readonly config: ConfigService) {
    const raw = Number(this.config.get<string>('CHECKIN_COOLDOWN_SECONDS') ?? '30');
    this.ttlSec = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 600) : 0;

    const redisUrl = this.config.get<string>('REDIS_URL');
    const enableRedis = this.config.get<string>('ENABLE_REDIS') === 'true';
    if (this.ttlSec > 0 && redisUrl && enableRedis) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableReadyCheck: true,
          retryStrategy: (times) => Math.min(times * 200, 3000),
        });
        this.redis.connect().catch((err) => {
          this.logger.warn(`CooldownRule Redis connect failed; in-memory fallback: ${err.message}`);
          this.redis = null;
        });
      } catch (err) {
        this.logger.warn(
          `CooldownRule Redis init failed; in-memory fallback: ${err instanceof Error ? err.message : String(err)}`,
        );
        this.redis = null;
      }
    }
  }

  async evaluate(ctx: CheckInContext): Promise<RuleResult> {
    if (this.ttlSec <= 0) return { pass: true };

    const key = `checkin:cooldown:${ctx.gym_id}:${ctx.member.id}`;
    const claimed = await this.claim(key, this.ttlSec);

    if (claimed) {
      // First successful pass through the rule wins the cooldown window —
      // subsequent attempts within ttlSec fail below. Note: we record the
      // window BEFORE the rest of the pipeline runs, which means a denied
      // attempt also opens the window. That's intentional: rapid-fire
      // denials (replay attempts) are also rate-limited.
      return { pass: true };
    }

    return {
      pass: false,
      reason: 'cooldown',
      message: `Please wait a moment before checking in again`,
      severity: 'overridable',
    };
  }

  /**
   * Atomic SET-NX. Returns true if the key was set (first claim within
   * the window), false if it already existed (cooldown hit).
   */
  private async claim(key: string, ttlSec: number): Promise<boolean> {
    if (this.redis) {
      try {
        const r = await this.redis.set(key, '1', 'PX', ttlSec * 1000, 'NX');
        return r === 'OK';
      } catch (err) {
        this.logger.warn(`Redis claim failed, falling back to memory: ${(err as Error).message}`);
      }
    }
    const now = Date.now();
    const existing = this.memory.get(key);
    if (existing && existing > now) return false;
    this.memory.set(key, now + ttlSec * 1000);

    if (this.memory.size > 4096) {
      for (const [k, exp] of this.memory) if (exp <= now) this.memory.delete(k);
    }
    return true;
  }

  async onModuleDestroy() {
    try {
      await this.redis?.quit();
    } catch {
      /* ignore */
    }
  }
}
