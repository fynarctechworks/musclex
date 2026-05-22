import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Fraud Signal Engine for B2B referrals.
 *
 * Design principles:
 *   * NEVER auto-bans. All signals route to the admin manual-review queue.
 *   * Severity buckets: low | medium | high | critical
 *   * risk_score (0–100) is the WEIGHTED SUM of active signals;
 *     score gates whether reward processing pauses for review.
 *   * Signals are append-only; reviews update review_status only.
 *
 * Signal types & weights:
 *   self_referral         critical    +100  (instant block)
 *   duplicate_phone        high        +50
 *   duplicate_email        high        +50
 *   duplicate_gst          high        +60
 *   duplicate_ip           medium      +25
 *   duplicate_device       medium      +30
 *   velocity               medium      +20  (>3 referrals in 24h)
 */
@Injectable()
export class ReferralFraudService {
  private readonly logger = new Logger(ReferralFraudService.name);

  /** Threshold at which a referral is held for manual review before rewards apply. */
  static readonly REVIEW_THRESHOLD = 50;
  /** Threshold at which a referral is auto-flagged as fraud (still no auto-ban — just status). */
  static readonly FRAUD_THRESHOLD = 100;

  private readonly SIGNAL_WEIGHTS: Record<string, number> = {
    self_referral:     100,
    duplicate_gst:      60,
    duplicate_phone:    50,
    duplicate_email:    50,
    duplicate_device:   30,
    duplicate_ip:       25,
    velocity:           20,
  };

  private readonly SIGNAL_SEVERITY: Record<string, string> = {
    self_referral:     'critical',
    duplicate_gst:     'high',
    duplicate_phone:   'high',
    duplicate_email:   'high',
    duplicate_device:  'medium',
    duplicate_ip:      'medium',
    velocity:          'medium',
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Collect all fraud signals for a referral.
   * Called at referral creation and re-evaluated before reward processing.
   *
   * Returns the computed risk_score (0–100, clamped).
   */
  async collectSignals(params: {
    referralId: string;
    referrerStudioId: string;
    referredStudioId: string;
    referredEmail?: string | null;
    fraudContext?: {
      ip?: string;
      deviceFingerprint?: string;
      userAgent?: string;
    };
  }): Promise<number> {
    const { referralId, referrerStudioId, referredStudioId, referredEmail } = params;

    // ── 1. self_referral: referrer === referred ────────────────────
    if (referrerStudioId === referredStudioId) {
      await this.recordSignal({
        referralId,
        subjectStudioId: referrerStudioId,
        signalType: 'self_referral',
        evidence: { referrer_studio_id: referrerStudioId },
      });
    }

    // ── 2. Studio identity collisions ──────────────────────────────
    const [referrer, referred] = await Promise.all([
      this.prisma.studio.findUnique({
        where: { id: referrerStudioId },
        select: { id: true, phone: true, email: true, tax_id: true },
      }),
      this.prisma.studio.findUnique({
        where: { id: referredStudioId },
        select: { id: true, phone: true, email: true, tax_id: true },
      }),
    ]);

    if (referrer && referred) {
      if (referrer.phone && referred.phone && referrer.phone === referred.phone) {
        await this.recordSignal({
          referralId,
          subjectStudioId: referredStudioId,
          signalType: 'duplicate_phone',
          evidence: { phone: referrer.phone },
        });
      }
      if (referrer.email && referred.email && referrer.email === referred.email) {
        await this.recordSignal({
          referralId,
          subjectStudioId: referredStudioId,
          signalType: 'duplicate_email',
          evidence: { email: referrer.email },
        });
      }
      if (referrer.tax_id && referred.tax_id && referrer.tax_id === referred.tax_id) {
        await this.recordSignal({
          referralId,
          subjectStudioId: referredStudioId,
          signalType: 'duplicate_gst',
          evidence: { tax_id: referrer.tax_id },
        });
      }
    }

    // ── 3. Cross-referral email reuse (different code, same email) ─
    if (referredEmail) {
      const reused = await this.prisma.referral.count({
        where: {
          referred_email: referredEmail.toLowerCase(),
          id:             { not: referralId },
          NOT:            { status: 'fraud' },
        },
      });
      if (reused > 0) {
        await this.recordSignal({
          referralId,
          subjectStudioId: referredStudioId,
          signalType: 'duplicate_email',
          evidence: { reused_email_count: reused },
        });
      }
    }

    // ── 4. Velocity: referrer signed up >3 in last 24h ─────────────
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.referral.count({
      where: { referrer_studio_id: referrerStudioId, created_at: { gte: since } },
    });
    if (recentCount > 3) {
      await this.recordSignal({
        referralId,
        subjectStudioId: referrerStudioId,
        signalType: 'velocity',
        evidence: { count_24h: recentCount },
      });
    }

    // ── Compute & persist risk_score ───────────────────────────────
    const score = await this.recomputeRiskScore(referralId);
    return score;
  }

  /**
   * Record a single signal. Idempotent on (referral_id, signal_type)
   * to avoid double-counting if collectSignals is re-run.
   */
  async recordSignal(params: {
    referralId?: string | null;
    subjectStudioId?: string | null;
    signalType: string;
    evidence: Record<string, unknown>;
  }): Promise<void> {
    const { referralId, subjectStudioId, signalType, evidence } = params;
    const severity = this.SIGNAL_SEVERITY[signalType] ?? 'low';

    // Skip if an identical pending signal already exists for this referral.
    if (referralId) {
      const dup = await this.prisma.referralFraudSignal.findFirst({
        where: { referral_id: referralId, signal_type: signalType, review_status: 'pending' },
        select: { id: true },
      });
      if (dup) {
        this.logger.debug(`Skipping duplicate signal ${signalType} for ${referralId}`);
        return;
      }
    }

    await this.prisma.referralFraudSignal.create({
      data: {
        referral_id:       referralId ?? null,
        subject_studio_id: subjectStudioId ?? null,
        signal_type:       signalType,
        severity,
        evidence:          evidence as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.warn(`Fraud signal: ${signalType} [severity=${severity}] referral=${referralId}`);
  }

  /**
   * Sum signal weights and write back to referrals.risk_score.
   * Clamped to [0, 100].
   */
  async recomputeRiskScore(referralId: string): Promise<number> {
    const signals = await this.prisma.referralFraudSignal.findMany({
      where:  { referral_id: referralId, review_status: { in: ['pending', 'confirmed_fraud'] } },
      select: { signal_type: true },
    });

    const raw = signals.reduce((acc, s) => acc + (this.SIGNAL_WEIGHTS[s.signal_type] ?? 0), 0);
    const score = Math.max(0, Math.min(100, raw));

    await this.prisma.referral.update({
      where: { id: referralId },
      data:  { risk_score: score },
    });

    return score;
  }

  /**
   * Should reward processing be paused for manual review?
   */
  shouldHoldForReview(riskScore: number): boolean {
    return riskScore >= ReferralFraudService.REVIEW_THRESHOLD;
  }

  /**
   * Should the referral be marked fraud outright?
   */
  shouldMarkFraud(riskScore: number): boolean {
    return riskScore >= ReferralFraudService.FRAUD_THRESHOLD;
  }

  // ── Admin review actions ────────────────────────────────────────

  async reviewSignal(params: {
    signalId: string;
    reviewerId: string;
    decision: 'reviewed_ok' | 'confirmed_fraud';
    notes?: string;
  }) {
    const updated = await this.prisma.referralFraudSignal.update({
      where: { id: params.signalId },
      data:  {
        review_status:   params.decision,
        reviewed_by:     params.reviewerId,
        reviewed_at:     new Date(),
        reviewer_notes:  params.notes ?? null,
      },
    });

    if (updated.referral_id) {
      await this.recomputeRiskScore(updated.referral_id);
    }
    return updated;
  }

  async listPending(opts: { severity?: string; limit?: number; offset?: number } = {}) {
    return this.prisma.referralFraudSignal.findMany({
      where: {
        review_status: 'pending',
        ...(opts.severity && { severity: opts.severity }),
      },
      orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
      take:    opts.limit ?? 50,
      skip:    opts.offset ?? 0,
      include: {
        referral: {
          select: {
            id:                  true,
            status:               true,
            risk_score:           true,
            referrer_studio:      { select: { id: true, name: true } },
            referred_studio:      { select: { id: true, name: true } },
          },
        },
        subject:  { select: { id: true, name: true } },
      },
    });
  }
}
