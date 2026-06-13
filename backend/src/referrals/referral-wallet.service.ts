import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { Prisma } from '../../node_modules/.prisma/client-public';

/**
 * ReferralWalletService — append-only credit ledger.
 *
 * Rules:
 *   * Every entry has a unique idempotency_key — same key never produces two entries.
 *   * Balance is the SUM of entries; the wallet.balance column is just a cache.
 *   * Debits cannot drive the balance negative.
 *   * Reversals are NEW entries with reverses_entry_id set (never UPDATE/DELETE).
 *   * Expiry is also a NEW entry (negative amount, source_type='expiry').
 *
 * Use cases:
 *   * credit on referral reward
 *   * debit on subscription renewal / addon purchase
 *   * reverse on referral fraud / refund
 *   * expire stale credits on a cron
 */
@Injectable()
export class ReferralWalletService {
  private readonly logger = new Logger(ReferralWalletService.name);

  constructor(private readonly pub: PublicPrismaService) {}

  // ── Wallet lifecycle ─────────────────────────────────────────────

  /** Get or create the wallet for a studio. */
  async ensureWallet(studioId: string, currency = 'INR') {
    return this.pub.referralWallet.upsert({
      where:  { studio_id: studioId },
      create: { studio_id: studioId, currency },
      update: {},
    });
  }

  async getBalance(studioId: string): Promise<{ balance: string; currency: string }> {
    const wallet = await this.pub.referralWallet.findUnique({
      where: { studio_id: studioId },
      select: { balance: true, currency: true },
    });
    if (!wallet) return { balance: '0.00', currency: 'INR' };
    return { balance: wallet.balance.toFixed(2), currency: wallet.currency };
  }

  // ── Core ledger operations ──────────────────────────────────────

  /**
   * Credit the wallet (positive amount).
   */
  async credit(params: {
    studioId: string;
    amount: number;
    currency?: string;
    sourceType: string;          // 'referral_reward' | 'manual_adjustment'
    sourceId?: string;
    rewardLogId?: string;
    idempotencyKey: string;
    expiresAt?: Date;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('credit amount must be positive');
    }
    return this.applyEntry({
      ...params,
      amount:     params.amount,
      entryType:  'credit',
    });
  }

  /**
   * Debit the wallet (positive amount; recorded as negative entry).
   * Throws ConflictException if insufficient balance.
   */
  async debit(params: {
    studioId: string;
    amount: number;
    currency?: string;
    sourceType: string;          // 'subscription_payment' | 'addon_purchase'
    sourceId?: string;
    idempotencyKey: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('debit amount must be positive');
    }
    return this.applyEntry({
      ...params,
      amount:    -params.amount,
      entryType: 'debit',
    });
  }

  /**
   * Reverse a previous entry (e.g. refund, fraud).
   * The reversal entry has the opposite sign of the original.
   */
  async reverse(params: {
    originalEntryId: string;
    reason: string;
    idempotencyKey: string;
  }) {
    const original = await this.pub.referralWalletEntry.findUnique({
      where: { id: params.originalEntryId },
      include: { wallet: { select: { studio_id: true, currency: true } } },
    });
    if (!original) throw new NotFoundException('Original entry not found');

    return this.applyEntry({
      studioId:        original.wallet.studio_id,
      amount:          original.amount.negated().toNumber(),
      currency:        original.currency,
      entryType:       'reversal',
      sourceType:      original.source_type,
      sourceId:        original.source_id ?? undefined,
      reverses_entry_id: original.id,
      idempotencyKey:  params.idempotencyKey,
      description:     `Reversal: ${params.reason}`,
      metadata:        { reverses_entry_id: original.id, reason: params.reason },
    });
  }

  /**
   * Expire credits that crossed their expires_at threshold.
   * Writes a single negative 'expiry' entry per stale credit.
   * Intended to be called from a cron job.
   */
  async expireStaleCredits(now = new Date()): Promise<number> {
    const stale = await this.pub.referralWalletEntry.findMany({
      where: {
        entry_type:  'credit',
        expires_at:  { not: null, lte: now },
      },
      select: { id: true, amount: true, currency: true, wallet_id: true },
    });

    let expiredCount = 0;
    for (const entry of stale) {
      // Skip if we've already written an expiry counter for this credit.
      const alreadyExpired = await this.pub.referralWalletEntry.findFirst({
        where:  { reverses_entry_id: entry.id, entry_type: 'expiry' },
        select: { id: true },
      });
      if (alreadyExpired) continue;

      const wallet = await this.pub.referralWallet.findUnique({
        where: { id: entry.wallet_id },
        select: { studio_id: true },
      });
      if (!wallet) continue;

      try {
        await this.applyEntry({
          studioId:          wallet.studio_id,
          amount:            entry.amount.negated().toNumber(),
          currency:          entry.currency,
          entryType:         'expiry',
          sourceType:        'expiry',
          sourceId:          entry.id,
          reverses_entry_id: entry.id,
          idempotencyKey:    `expiry_${entry.id}`,
          description:       'Credit expired',
        });
        expiredCount++;
      } catch (err) {
        this.logger.warn(`Failed to expire entry ${entry.id}: ${(err as Error).message}`);
      }
    }
    return expiredCount;
  }

  // ── Private write path ──────────────────────────────────────────

  private async applyEntry(params: {
    studioId: string;
    amount: number;          // signed
    currency?: string;
    entryType: string;       // 'credit' | 'debit' | 'reversal' | 'expiry'
    sourceType: string;
    sourceId?: string;
    rewardLogId?: string;
    reverses_entry_id?: string;
    idempotencyKey: string;
    expiresAt?: Date;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.pub.$transaction(
      async (tx) => {
        const wallet = await tx.referralWallet.upsert({
          where:  { studio_id: params.studioId },
          create: { studio_id: params.studioId, currency: params.currency ?? 'INR' },
          update: {},
        });

        if (wallet.status === 'frozen') {
          throw new ConflictException('Wallet is frozen');
        }

        // Idempotency guard
        const existing = await tx.referralWalletEntry.findUnique({
          where:  { idempotency_key: params.idempotencyKey },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException('Entry already applied');
        }

        // Insufficient-funds check for negative entries.
        // Use $queryRaw to compute the live sum inside the same tx.
        if (params.amount < 0) {
          const rows = await tx.$queryRaw<Array<{ sum: string | null }>>`
            SELECT COALESCE(SUM("amount"), 0) AS sum
            FROM "public"."referral_wallet_entries"
            WHERE "wallet_id" = ${wallet.id}::uuid
          `;
          const currentBalance = Number(rows[0]?.sum ?? '0');
          if (currentBalance + params.amount < 0) {
            throw new ConflictException(
              `Insufficient referral wallet balance: have ${currentBalance.toFixed(2)}, need ${Math.abs(params.amount).toFixed(2)}`,
            );
          }
        }

        const entry = await tx.referralWalletEntry.create({
          data: {
            wallet_id:         wallet.id,
            entry_type:        params.entryType,
            amount:            new Prisma.Decimal(params.amount),
            currency:          params.currency ?? wallet.currency,
            source_type:       params.sourceType,
            source_id:         params.sourceId ?? null,
            reward_log_id:     params.rewardLogId ?? null,
            reverses_entry_id: params.reverses_entry_id ?? null,
            idempotency_key:   params.idempotencyKey,
            expires_at:        params.expiresAt ?? null,
            description:       params.description ?? null,
            metadata:          (params.metadata ?? {}) as Prisma.InputJsonValue,
          },
        });

        // Recompute cached balance from authoritative source.
        await tx.$executeRaw`
          UPDATE "public"."referral_wallets"
          SET "balance" = (
            SELECT COALESCE(SUM("amount"), 0)
            FROM "public"."referral_wallet_entries"
            WHERE "wallet_id" = ${wallet.id}::uuid
          ),
          "updated_at" = NOW()
          WHERE "id" = ${wallet.id}::uuid
        `;

        return entry;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ── Queries ─────────────────────────────────────────────────────

  async listEntries(studioId: string, opts: { limit?: number; offset?: number } = {}) {
    const wallet = await this.pub.referralWallet.findUnique({
      where:  { studio_id: studioId },
      select: { id: true },
    });
    if (!wallet) return [];

    return this.pub.referralWalletEntry.findMany({
      where:   { wallet_id: wallet.id },
      orderBy: { created_at: 'desc' },
      take:    opts.limit ?? 50,
      skip:    opts.offset ?? 0,
    });
  }
}
