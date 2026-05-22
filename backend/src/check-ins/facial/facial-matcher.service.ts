import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * pgvector-backed 1:N facial matcher.
 *
 * Uses the IVFFlat index on members.face_vec (built with vector_cosine_ops
 * in migration 20260519_checkin_module_enterprise). Cosine distance is
 * monotonic with Euclidean for unit-length descriptors (face-api.js
 * descriptors are L2-normalized), so cosine results are equivalent to
 * the old in-process Euclidean matcher under the relationship:
 *
 *   L2_distance² = 2 × cosine_distance
 *
 * Confidence is reported as `max(0, 1 - cosine_distance)` so the existing
 * frontend continues to receive a 0..1 value.
 *
 * Thresholds (tunable via env):
 *   FACE_MATCH_COSINE_THRESHOLD (default 0.4) — match cutoff
 *   FACE_MATCH_LEGACY_FALLBACK  (default true) — try Float[] scan if face_vec is empty
 */
@Injectable()
export class FacialMatcherService {
  private readonly logger = new Logger(FacialMatcherService.name);
  private readonly matchThreshold: number;
  private readonly legacyFallback: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const t = parseFloat(
      this.config.get<string>('FACE_MATCH_COSINE_THRESHOLD') ?? '0.4',
    );
    this.matchThreshold = Number.isFinite(t) && t > 0 && t < 2 ? t : 0.4;
    this.legacyFallback =
      this.config.get<string>('FACE_MATCH_LEGACY_FALLBACK') !== 'false';
  }

  /**
   * Find the best face_vec match in this branch, scoped to the active
   * tenant by the search_path set in TenantMiddleware.
   *
   * Returns null if no candidate is within threshold.
   */
  async match(input: { descriptor: number[]; branch_id: string }): Promise<{
    member_id: string;
    full_name: string;
    distance: number;
    confidence: number;
    matcher: 'pgvector' | 'legacy';
    candidates_scanned: number;
    elapsed_ms: number;
  } | null> {
    if (!Array.isArray(input.descriptor) || input.descriptor.length !== 128) {
      this.logger.warn(`Bad descriptor length: ${input.descriptor?.length}`);
      return null;
    }

    const startMs = Date.now();
    const vecLiteral = `[${input.descriptor.map((n) => safeFloat(n)).join(',')}]`;

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; full_name: string; distance: number }>
    >`
      SELECT id, full_name, (face_vec <=> ${vecLiteral}::vector)::float8 AS distance
      FROM studio_template.members
      WHERE face_vec IS NOT NULL
        AND branch_id = ${input.branch_id}::uuid
        AND status IN ('active', 'expiring_soon', 'trial')
      ORDER BY face_vec <=> ${vecLiteral}::vector
      LIMIT 1
    `;

    const elapsedMs = Date.now() - startMs;
    if (elapsedMs > 200) {
      this.logger.warn(
        `Slow pgvector facial scan: ${elapsedMs}ms (branch=${input.branch_id})`,
      );
    }

    if (rows.length === 0) {
      // No members with face_vec yet — try legacy Float[] scan as a safety
      // net while rotation is incomplete. Disable via env when ready to
      // fully retire the legacy column.
      if (this.legacyFallback) {
        const fallback = await this.legacyMatch(input);
        if (fallback) {
          return {
            ...fallback,
            matcher: 'legacy',
            elapsed_ms: Date.now() - startMs,
          };
        }
      }
      return null;
    }

    const best = rows[0];
    if (best.distance >= this.matchThreshold) {
      return null;
    }

    return {
      member_id: best.id,
      full_name: best.full_name,
      distance: best.distance,
      confidence: Math.max(0, 1 - best.distance),
      matcher: 'pgvector',
      candidates_scanned: 1, // IVFFlat returns the nearest neighbor directly
      elapsed_ms: elapsedMs,
    };
  }

  /**
   * Legacy O(N) Euclidean scan over members.face_descriptor (Float[]).
   * Bounded to 2000 candidates to preserve the prior pathological-case
   * latency budget. Only reached when face_vec is empty everywhere — i.e.
   * a tenant where the Phase 3a backfill found nothing.
   */
  private async legacyMatch(input: {
    descriptor: number[];
    branch_id: string;
  }): Promise<{
    member_id: string;
    full_name: string;
    distance: number;
    confidence: number;
    candidates_scanned: number;
  } | null> {
    const BATCH = 200;
    const HARD_LIMIT = 2000;
    const MATCH_L2 = 0.5;
    const NEAR_PERFECT_L2 = 0.2;

    let best: { id: string; full_name: string } | null = null;
    let bestL2 = Infinity;
    let scanned = 0;
    let cursor: string | undefined;

    while (true) {
      const members = await this.prisma.member.findMany({
        where: {
          branch_id: input.branch_id,
          face_descriptor: { isEmpty: false },
          status: { in: ['active', 'expiring_soon'] },
        },
        select: { id: true, full_name: true, face_descriptor: true },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });
      if (members.length === 0) break;
      cursor = members[members.length - 1].id;
      scanned += members.length;

      for (const m of members) {
        if (m.face_descriptor.length !== 128) continue;
        let sum = 0;
        for (let i = 0; i < 128; i++) {
          const d = input.descriptor[i] - m.face_descriptor[i];
          sum += d * d;
          if (sum > bestL2 * bestL2) break;
        }
        const l2 = Math.sqrt(sum);
        if (l2 < bestL2) {
          bestL2 = l2;
          best = { id: m.id, full_name: m.full_name };
        }
      }

      if (bestL2 < NEAR_PERFECT_L2 || scanned >= HARD_LIMIT) break;
      if (members.length < BATCH) break;
    }

    if (!best || bestL2 >= MATCH_L2) return null;

    return {
      member_id: best.id,
      full_name: best.full_name,
      distance: bestL2,
      confidence: Math.max(0, 1 - bestL2),
      candidates_scanned: scanned,
    };
  }
}

function safeFloat(n: unknown): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return v.toString();
}
