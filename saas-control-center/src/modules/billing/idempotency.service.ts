import {
  Injectable,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyCheckResult<T = unknown> {
  replayed: boolean;
  response?: T;
  status_code?: number;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private prisma: PrismaService) {}

  hashRequest(endpoint: string, params: Record<string, unknown>): string {
    const canonical = JSON.stringify({ endpoint, params: this.sortKeys(params) });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Reserves an idempotency key for an in-flight request. If the key exists:
   *  - same endpoint + same body + has a stored response → replay it
   *  - same endpoint + same body + no stored response   → 409 (concurrent in-flight)
   *  - different endpoint                                → 409 (key reused on different endpoint)
   *  - same endpoint + different body                    → 422 (key reused with different payload)
   */
  async checkOrReserve<T = unknown>(
    key: string,
    endpoint: string,
    requestHash: string,
    adminId?: string,
  ): Promise<IdempotencyCheckResult<T>> {
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });

    if (existing) {
      if (existing.endpoint !== endpoint) {
        throw new ConflictException(
          'Idempotency-Key was previously used on a different endpoint',
        );
      }
      if (existing.request_hash !== requestHash) {
        throw new UnprocessableEntityException(
          'Idempotency-Key was previously used with a different request payload',
        );
      }
      if (existing.response_body !== null) {
        return {
          replayed: true,
          response: existing.response_body as T,
          status_code: existing.status_code ?? 200,
        };
      }
      throw new ConflictException(
        'A request with this Idempotency-Key is already in progress',
      );
    }

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          endpoint,
          admin_id: adminId,
          request_hash: requestHash,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Lost a race with a concurrent request that reserved the same key.
        throw new ConflictException(
          'A request with this Idempotency-Key is already in progress',
        );
      }
      throw err;
    }

    return { replayed: false };
  }

  async saveResponse(key: string, response: unknown, statusCode = 200): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        response_body: (response ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        status_code: statusCode,
      },
    });
  }

  /**
   * Releases a reservation when the underlying operation fails. The caller's
   * error propagates; subsequent retries with the same key will start fresh.
   */
  async release(key: string): Promise<void> {
    await this.prisma.idempotencyKey
      .delete({ where: { key } })
      .catch(() => undefined);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
    const { count } = await this.prisma.idempotencyKey.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(`Pruned ${count} expired idempotency keys`);
    }
  }

  private sortKeys(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => this.sortKeys(v));
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = this.sortKeys((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
}
