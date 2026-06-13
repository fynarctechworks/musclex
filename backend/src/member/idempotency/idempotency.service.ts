import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../node_modules/.prisma/client-public';
import { createHash } from 'crypto';
import { PublicPrismaService } from '../../prisma/public-prisma.service';

export interface IdempotencyKeyRef {
  tenantId: string;
  memberId: string;
  key: string;
  endpoint: string;
  requestHash: string;
}

export type ClaimResult =
  | { kind: 'fresh' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'conflict'; reason: 'key_reused' | 'in_progress' | 'race' };

/**
 * ────────────────────────────────────────────────────────────────
 * IDEMPOTENCY SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Backs the member write endpoints' Idempotency-Key behaviour using
 * public.member_idempotency_keys, scoped per (tenant, member, key). The unique
 * constraint makes claim() atomic: the first request inserts an in_progress
 * row; concurrent/duplicate requests hit the conflict and either replay the
 * stored response or are rejected.
 */
@Injectable()
export class IdempotencyService {
  /** Stored responses live this long before a key may be reused. */
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  constructor(private readonly pub: PublicPrismaService) {}

  /** Stable hash of the request body — detects a key reused with a different payload. */
  hashRequest(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? null))
      .digest('hex');
  }

  /**
   * Attempt to claim a key for a fresh execution. Returns:
   *  - fresh:    caller should run the handler then call complete()
   *  - replay:   caller should return the stored response as-is
   *  - conflict: caller should reject (reused with different body, or in flight)
   */
  async claim(ref: IdempotencyKeyRef): Promise<ClaimResult> {
    try {
      await this.pub.memberIdempotencyKey.create({
        data: {
          tenant_id: ref.tenantId,
          member_id: ref.memberId,
          idempotency_key: ref.key,
          endpoint: ref.endpoint,
          request_hash: ref.requestHash,
          status: 'in_progress',
          expires_at: new Date(Date.now() + this.ttlMs),
        },
      });
      return { kind: 'fresh' };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.pub.memberIdempotencyKey.findUnique({
          where: {
            tenant_id_member_id_idempotency_key: {
              tenant_id: ref.tenantId,
              member_id: ref.memberId,
              idempotency_key: ref.key,
            },
          },
        });
        if (!existing) return { kind: 'conflict', reason: 'race' };
        if (
          existing.endpoint !== ref.endpoint ||
          existing.request_hash !== ref.requestHash
        ) {
          return { kind: 'conflict', reason: 'key_reused' };
        }
        if (existing.status === 'completed') {
          return {
            kind: 'replay',
            status: existing.response_status ?? 200,
            body: existing.response_body,
          };
        }
        return { kind: 'conflict', reason: 'in_progress' };
      }
      throw err;
    }
  }

  /** Persist the final response so future retries replay it. */
  async complete(
    ref: IdempotencyKeyRef,
    status: number,
    body: unknown,
  ): Promise<void> {
    await this.pub.memberIdempotencyKey.update({
      where: {
        tenant_id_member_id_idempotency_key: {
          tenant_id: ref.tenantId,
          member_id: ref.memberId,
          idempotency_key: ref.key,
        },
      },
      data: {
        status: 'completed',
        response_status: status,
        // Prisma rejects raw `null` for Json — use DbNull when there's no body.
        response_body:
          body === undefined || body === null
            ? Prisma.DbNull
            : (body as Prisma.InputJsonValue),
      },
    });
  }

  /**
   * Release an in_progress claim after a handler failure so the client may
   * legitimately retry the same key. Only deletes if still in_progress.
   */
  async release(ref: IdempotencyKeyRef): Promise<void> {
    await this.pub.memberIdempotencyKey.deleteMany({
      where: {
        tenant_id: ref.tenantId,
        member_id: ref.memberId,
        idempotency_key: ref.key,
        status: 'in_progress',
      },
    });
  }
}
