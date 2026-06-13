import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { Prisma } from '../../node_modules/.prisma/client-public';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import { ReferralFraudService } from './referral-fraud.service';
import { ReferralWalletService } from './referral-wallet.service';

/**
 * Manual control surface for SaaS admins.
 *
 * Capabilities:
 *   - Review fraud signals (approve/confirm/dismiss)
 *   - Force a lifecycle transition (bypass FSM — last resort, audited)
 *   - Revoke a reward (writes reversal entries; subscription extension reversal NOT supported here)
 *   - Freeze / unfreeze a wallet
 *   - Manually credit / debit a wallet
 *   - Reconcile risk_score for a referral
 *
 * Every admin action is logged in referral_lifecycle_events with actor_type='admin'.
 */
@Injectable()
export class ReferralAdminService {
  private readonly logger = new Logger(ReferralAdminService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly lifecycle: ReferralLifecycleService,
    private readonly fraud: ReferralFraudService,
    private readonly wallet: ReferralWalletService,
  ) {}

  // ── Fraud review queue ───────────────────────────────────────────

  async listFraudQueue(opts: {
    severity?: string;
    review_status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const where: Prisma.ReferralFraudSignalWhereInput = {
      review_status: opts.review_status ?? 'pending',
      ...(opts.severity && { severity: opts.severity }),
    };
    const [items, total] = await Promise.all([
      this.pub.referralFraudSignal.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
        take:    opts.limit ?? 50,
        skip:    opts.offset ?? 0,
        include: {
          referral: {
            select: {
              id:              true,
              status:          true,
              risk_score:      true,
              referral_code:   true,
              referrer_studio: { select: { id: true, name: true } },
              referred_studio: { select: { id: true, name: true } },
            },
          },
          subject: { select: { id: true, name: true } },
        },
      }),
      this.pub.referralFraudSignal.count({ where }),
    ]);
    return { items, total };
  }

  async reviewFraudSignal(params: {
    signalId: string;
    reviewerId: string;
    decision: 'reviewed_ok' | 'confirmed_fraud';
    notes?: string;
  }) {
    const signal = await this.fraud.reviewSignal(params);

    // If confirmed_fraud, also transition the referral to 'fraud' (terminal).
    if (params.decision === 'confirmed_fraud' && signal.referral_id) {
      await this.lifecycle.transition({
        referralId: signal.referral_id,
        toStatus:   'fraud',
        actorType:  'admin',
        actorId:    params.reviewerId,
        payload:    { signal_id: signal.id, notes: params.notes },
      });
    }
    return signal;
  }

  // ── Force lifecycle transition (bypasses FSM) ───────────────────

  /**
   * Admin escape hatch. Writes the transition directly and an audit row.
   * Use only when the FSM blocks a legitimate state correction
   * (e.g., a state migration after a code bug).
   */
  async forceTransition(params: {
    referralId: string;
    toStatus: string;
    adminId: string;
    reason: string;
  }) {
    if (!params.reason || params.reason.length < 5) {
      throw new BadRequestException('A reason (>=5 chars) is required for forced transitions');
    }

    const referral = await this.pub.referral.findUnique({
      where: { id: params.referralId },
      select: { id: true, status: true },
    });
    if (!referral) throw new NotFoundException('Referral not found');
    const fromStatus = referral.status;

    if (fromStatus === params.toStatus) {
      throw new ConflictException('Referral already in requested status');
    }

    await this.pub.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id: params.referralId },
        data:  { status: params.toStatus, updated_at: new Date() },
      });
      await tx.referralLifecycleEvent.create({
        data: {
          referral_id: params.referralId,
          from_status: fromStatus,
          to_status:   params.toStatus,
          actor_type:  'admin',
          actor_id:    params.adminId,
          payload:     { forced: true, reason: params.reason } as Prisma.InputJsonValue,
        },
      });
    });

    this.logger.warn(
      `Admin force-transition: ${params.referralId} ${fromStatus} → ${params.toStatus} by ${params.adminId} (${params.reason})`,
    );
    return { ok: true, from_status: fromStatus, to_status: params.toStatus };
  }

  // ── Reward revocation ────────────────────────────────────────────

  /**
   * Revoke an applied reward.
   * For wallet_credit: writes a reversal entry on the ledger.
   * For other reward types: marks the log 'reversed' (subscription extension
   * cannot be "un-extended" automatically — it's a manual billing op).
   */
  async revokeReward(params: {
    rewardLogId: string;
    adminId: string;
    reason: string;
  }) {
    if (!params.reason || params.reason.length < 5) {
      throw new BadRequestException('reason (>=5 chars) required');
    }

    const log = await this.pub.rewardLog.findUnique({
      where: { id: params.rewardLogId },
    });
    if (!log) throw new NotFoundException('Reward log not found');
    if (log.status === 'reversed') {
      throw new ConflictException('Reward already reversed');
    }

    // Reverse wallet ledger entry if reward was wallet_credit.
    if (log.reward_type === 'wallet_credit') {
      const ledgerEntry = await this.pub.referralWalletEntry.findFirst({
        where: { reward_log_id: log.id, entry_type: 'credit' },
      });
      if (ledgerEntry) {
        await this.wallet.reverse({
          originalEntryId: ledgerEntry.id,
          reason:          params.reason,
          idempotencyKey:  `revoke_${log.id}_${params.adminId}`,
        });
      }
    }

    // Mark log row as reversed (status field only — row stays append-only otherwise).
    await this.pub.rewardLog.update({
      where: { id: log.id },
      data:  {
        status:          'reversed',
        reversed_at:     new Date(),
        reversed_reason: params.reason,
      },
    });

    // If this was the only reward on the referral, transition to 'reversed'.
    const remaining = await this.pub.rewardLog.count({
      where: { referral_id: log.referral_id, status: 'applied' },
    });
    if (remaining === 0) {
      await this.lifecycle.transition({
        referralId: log.referral_id,
        toStatus:   'reversed',
        actorType:  'admin',
        actorId:    params.adminId,
        payload:    { reason: params.reason, reward_log_id: log.id },
      });
    }

    this.logger.warn(
      `Reward ${log.id} revoked by admin ${params.adminId}: ${params.reason}`,
    );
    return { ok: true, log_id: log.id };
  }

  // ── Wallet ops ───────────────────────────────────────────────────

  async freezeWallet(params: { studioId: string; adminId: string; reason: string }) {
    if (!params.reason || params.reason.length < 5) {
      throw new BadRequestException('reason required');
    }
    const wallet = await this.wallet.ensureWallet(params.studioId);
    await this.pub.referralWallet.update({
      where: { id: wallet.id },
      data:  { status: 'frozen' },
    });
    this.logger.warn(`Wallet ${wallet.id} frozen by ${params.adminId}: ${params.reason}`);
    return { ok: true };
  }

  async unfreezeWallet(params: { studioId: string; adminId: string }) {
    const wallet = await this.wallet.ensureWallet(params.studioId);
    await this.pub.referralWallet.update({
      where: { id: wallet.id },
      data:  { status: 'active' },
    });
    return { ok: true };
  }

  async manualWalletAdjustment(params: {
    studioId: string;
    amount: number;          // signed
    currency?: string;
    reason: string;
    adminId: string;
  }) {
    if (!params.reason || params.reason.length < 5) {
      throw new BadRequestException('reason required');
    }
    const idempotencyKey = `manual_${params.studioId}_${params.adminId}_${Date.now()}`;

    if (params.amount > 0) {
      return this.wallet.credit({
        studioId:       params.studioId,
        amount:         params.amount,
        currency:       params.currency,
        sourceType:     'manual_adjustment',
        idempotencyKey,
        description:    `Admin credit: ${params.reason}`,
        metadata:       { admin_id: params.adminId, reason: params.reason },
      });
    }
    if (params.amount < 0) {
      return this.wallet.debit({
        studioId:       params.studioId,
        amount:         Math.abs(params.amount),
        currency:       params.currency,
        sourceType:     'manual_adjustment',
        idempotencyKey,
        description:    `Admin debit: ${params.reason}`,
        metadata:       { admin_id: params.adminId, reason: params.reason },
      });
    }
    throw new BadRequestException('amount must be non-zero');
  }

  // ── Risk score reconciliation ────────────────────────────────────

  async recomputeRiskScore(referralId: string) {
    const score = await this.fraud.recomputeRiskScore(referralId);
    return { referral_id: referralId, risk_score: score };
  }

  // ── Aggregate dashboards ─────────────────────────────────────────

  /**
   * Funnel metrics: count of referrals at each lifecycle status,
   * total rewards applied/reversed, total wallet credits issued,
   * fraud signals open, top-risk referrals.
   */
  async getOverview() {
    const [byStatus, rewards, wallet, fraud] = await Promise.all([
      this.pub.referral.groupBy({
        by:     ['status'],
        _count: true,
      }),
      this.pub.rewardLog.groupBy({
        by:     ['status', 'reward_type'],
        _count: true,
      }),
      this.pub.referralWalletEntry.groupBy({
        by:     ['entry_type'],
        _sum:   { amount: true },
      }),
      this.pub.referralFraudSignal.groupBy({
        by:     ['severity', 'review_status'],
        _count: true,
      }),
    ]);

    const topRisk = await this.pub.referral.findMany({
      where:   { risk_score: { gt: 0 }, status: { notIn: ['fraud', 'reversed'] } },
      orderBy: { risk_score: 'desc' },
      take:    10,
      select: {
        id:              true,
        status:          true,
        risk_score:      true,
        referrer_studio: { select: { name: true } },
        referred_studio: { select: { name: true } },
      },
    });

    return {
      lifecycle_funnel: byStatus.map((s) => ({ status: s.status, count: s._count })),
      rewards:          rewards.map((r) => ({
        status:      r.status,
        reward_type: r.reward_type,
        count:       r._count,
      })),
      wallet_totals:    wallet.map((w) => ({
        entry_type: w.entry_type,
        total:      w._sum.amount?.toFixed(2) ?? '0.00',
      })),
      fraud:            fraud.map((f) => ({
        severity:      f.severity,
        review_status: f.review_status,
        count:         f._count,
      })),
      top_risk_referrals: topRisk,
    };
  }
}
