import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

export interface IdempotencyRef {
  /** Tenant (studio) id — scopes the key so two gyms can't collide. */
  tenantId: string;
  /** Acting user id — scopes per operator. */
  userId: string;
  /** Stable operation id (METHOD Class#handler). */
  endpoint: string;
  /** Client-supplied Idempotency-Key header value. */
  key: string;
  /** sha256 of the request body — detects key reuse with a different payload. */
  requestHash: string;
}

export type ClaimResult =
  | { kind: 'fresh' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'conflict'; reason: 'key_reused' | 'in_progress' };

interface StoredRecord {
  status: 'in_progress' | 'completed';
  requestHash: string;
  response_status?: number;
  response_body?: unknown;
}

/**
 * Redis-backed idempotency store for STAFF financial mutations, with an
 * in-process fallback so dev/test keep working without Redis.
 *
 * Deliberately NOT a new Postgres table (that would be a schema change). Redis
 * is the right tier for a 24h dedup window and is what the security audit
 * recommended. Cluster-safe via `SET key val NX PX ttl` (atomic claim). Under
 * the in-memory fallback the claim is atomic too (single-threaded check-set),
 * but only within one process — acceptable for dev; prod runs Redis.
 */
@Injectable()
export class IdempotencyStore implements OnModuleDestroy {
  private readonly logger = new Logger(IdempotencyStore.name);
  private redis: Redis | null = null;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  /** 24h dedup window. */
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

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
            `Idempotency Redis connect failed, using in-memory fallback: ${err.message}`,
          );
          this.redis = null;
        });
      } catch (err) {
        this.logger.warn(
          `Idempotency Redis init failed, using in-memory fallback: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        this.redis = null;
      }
    }
  }

  hashRequest(body: unknown): string {
    let serialized = '';
    try {
      serialized = JSON.stringify(body ?? null);
    } catch {
      serialized = String(body);
    }
    return createHash('sha256').update(serialized).digest('hex');
  }

  private redisKey(ref: IdempotencyRef): string {
    const scope = createHash('sha256')
      .update(`${ref.tenantId}|${ref.userId}|${ref.endpoint}`)
      .digest('hex')
      .slice(0, 24);
    return `idem:${scope}:${ref.key}`;
  }

  /**
   * Atomically claim the key. Fresh → caller runs the handler. Replay → return
   * the stored response. Conflict → same key reused with a different body, or a
   * request is still in flight.
   */
  async claim(ref: IdempotencyRef): Promise<ClaimResult> {
    const k = this.redisKey(ref);
    const fresh: StoredRecord = { status: 'in_progress', requestHash: ref.requestHash };
    const freshJson = JSON.stringify(fresh);

    if (this.redis) {
      try {
        const ok = await this.redis.set(k, freshJson, 'PX', this.TTL_MS, 'NX');
        if (ok === 'OK') return { kind: 'fresh' };
        const raw = await this.redis.get(k);
        return this.evaluateExisting(raw, ref);
      } catch (err) {
        this.logger.warn(
          `Idempotency claim Redis error (${k}); failing open: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return { kind: 'fresh' }; // fail-open: never block a real payment on a cache outage
      }
    }

    // In-memory fallback (single-process atomic).
    const existing = this.memGet(k);
    if (existing == null) {
      this.memSet(k, freshJson);
      return { kind: 'fresh' };
    }
    return this.evaluateExisting(existing, ref);
  }

  private evaluateExisting(raw: string | null, ref: IdempotencyRef): ClaimResult {
    if (!raw) return { kind: 'fresh' };
    let rec: StoredRecord;
    try {
      rec = JSON.parse(raw) as StoredRecord;
    } catch {
      return { kind: 'fresh' };
    }
    if (rec.requestHash !== ref.requestHash) return { kind: 'conflict', reason: 'key_reused' };
    if (rec.status === 'completed') {
      return { kind: 'replay', status: rec.response_status ?? 200, body: rec.response_body };
    }
    return { kind: 'conflict', reason: 'in_progress' };
  }

  /** Persist the final response so a retry of the same key replays it. */
  async complete(ref: IdempotencyRef, status: number, body: unknown): Promise<void> {
    const k = this.redisKey(ref);
    const rec: StoredRecord = {
      status: 'completed',
      requestHash: ref.requestHash,
      response_status: status,
      response_body: body,
    };
    const json = JSON.stringify(rec);
    if (this.redis) {
      try {
        await this.redis.set(k, json, 'PX', this.TTL_MS);
        return;
      } catch (err) {
        this.logger.warn(`Idempotency complete Redis error (${k}): ${(err as Error).message}`);
      }
    }
    this.memSet(k, json);
  }

  /** Release an in-progress claim so a failed request can be retried. */
  async release(ref: IdempotencyRef): Promise<void> {
    const k = this.redisKey(ref);
    if (this.redis) {
      try {
        await this.redis.del(k);
        return;
      } catch (err) {
        this.logger.warn(`Idempotency release Redis error (${k}): ${(err as Error).message}`);
      }
    }
    this.memory.delete(k);
  }

  private memGet(k: string): string | null {
    const entry = this.memory.get(k);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(k);
      return null;
    }
    return entry.value;
  }

  private memSet(k: string, value: string): void {
    this.memory.set(k, { value, expiresAt: Date.now() + this.TTL_MS });
    if (this.memory.size > 5000) {
      const now = Date.now();
      for (const [key, v] of this.memory) if (v.expiresAt < now) this.memory.delete(key);
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis?.quit();
    } catch {
      // tearing down
    }
  }
}
