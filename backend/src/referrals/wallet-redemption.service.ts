import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ReferralWalletService } from './referral-wallet.service';

/**
 * WalletRedemptionService
 *
 * The "use credits at checkout" surface. The billing pipeline calls this
 * BEFORE charging a payment gateway. The redemption flow is:
 *
 *   1. quoteRedemption(studio, plan_total) → returns the maximum credit usable
 *      (capped at the lesser of: wallet balance, plan total, per-policy cap).
 *   2. caller shows the quote to the user; user confirms.
 *   3. applyRedemption(quote_id, idempotency_key) → debits the ledger atomically
 *      and returns a "credit_applied" voucher the billing service attaches
 *      to the upcoming charge (so the gateway is charged total - credit_applied).
 *   4. if the charge later fails, caller invokes reverseRedemption(redemption_id).
 *
 * The redemption itself is a wallet debit with source_type='subscription_payment'.
 * It is NEVER applied speculatively — the caller controls both apply and reverse.
 */
@Injectable()
export class WalletRedemptionService {
  private readonly logger = new Logger(WalletRedemptionService.name);

  /** Maximum % of an invoice that can be paid with referral credit (policy). */
  static readonly MAX_REDEMPTION_PCT = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: ReferralWalletService,
  ) {}

  /**
   * Compute the redemption ceiling for a given invoice / plan total.
   * Does NOT debit — pure calculation.
   */
  async quoteRedemption(params: {
    studioId: string;
    planTotal: number;
    currency: string;
  }): Promise<{
    eligible_credit: string;
    max_redemption_pct: number;
    wallet_balance: string;
    invoice_total: string;
    currency: string;
  }> {
    if (params.planTotal <= 0) {
      throw new BadRequestException('planTotal must be > 0');
    }

    const wallet = await this.wallet.ensureWallet(params.studioId, params.currency);
    if (wallet.status === 'frozen') {
      return {
        eligible_credit: '0.00',
        max_redemption_pct: WalletRedemptionService.MAX_REDEMPTION_PCT,
        wallet_balance:  wallet.balance.toFixed(2),
        invoice_total:   params.planTotal.toFixed(2),
        currency:        params.currency,
      };
    }
    if (wallet.currency !== params.currency) {
      // No FX conversion in Phase 1 — return zero eligible.
      return {
        eligible_credit: '0.00',
        max_redemption_pct: 0,
        wallet_balance:  wallet.balance.toFixed(2),
        invoice_total:   params.planTotal.toFixed(2),
        currency:        params.currency,
      };
    }

    const policyCap = (params.planTotal * WalletRedemptionService.MAX_REDEMPTION_PCT) / 100;
    const eligible = Math.min(wallet.balance.toNumber(), policyCap, params.planTotal);

    return {
      eligible_credit:    eligible.toFixed(2),
      max_redemption_pct: WalletRedemptionService.MAX_REDEMPTION_PCT,
      wallet_balance:     wallet.balance.toFixed(2),
      invoice_total:      params.planTotal.toFixed(2),
      currency:           params.currency,
    };
  }

  /**
   * Apply a redemption — debits the ledger and returns a voucher
   * the billing service uses to compute the charge amount.
   *
   * Idempotent: same idempotencyKey returns the same redemption.
   */
  async applyRedemption(params: {
    studioId: string;
    requestedAmount: number;
    planTotal: number;
    currency: string;
    invoiceId: string;
    idempotencyKey: string;
  }): Promise<{
    redemption_id: string;
    credit_applied: string;
    remaining_to_charge: string;
    currency: string;
  }> {
    if (params.requestedAmount <= 0) {
      throw new BadRequestException('requestedAmount must be > 0');
    }

    // Re-validate against the live quote — never trust the client.
    const quote = await this.quoteRedemption({
      studioId:  params.studioId,
      planTotal: params.planTotal,
      currency:  params.currency,
    });
    const eligible = Number(quote.eligible_credit);
    const finalAmount = Math.min(params.requestedAmount, eligible);

    if (finalAmount <= 0) {
      return {
        redemption_id:       'noop',
        credit_applied:      '0.00',
        remaining_to_charge: params.planTotal.toFixed(2),
        currency:            params.currency,
      };
    }

    const entry = await this.wallet.debit({
      studioId:       params.studioId,
      amount:         finalAmount,
      currency:       params.currency,
      sourceType:     'subscription_payment',
      sourceId:       params.invoiceId,
      idempotencyKey: params.idempotencyKey,
      description:    `Credit applied to invoice ${params.invoiceId}`,
      metadata:       { invoice_id: params.invoiceId, plan_total: params.planTotal },
    });

    return {
      redemption_id:       entry.id,
      credit_applied:      finalAmount.toFixed(2),
      remaining_to_charge: Math.max(0, params.planTotal - finalAmount).toFixed(2),
      currency:            params.currency,
    };
  }

  /**
   * Reverse a redemption — used when the downstream charge fails.
   * Writes a credit entry that restores the redeemed amount.
   */
  async reverseRedemption(params: {
    redemptionEntryId: string;
    reason: string;
  }): Promise<{ reversal_id: string }> {
    if (params.redemptionEntryId === 'noop') {
      return { reversal_id: 'noop' };
    }

    const reversal = await this.wallet.reverse({
      originalEntryId: params.redemptionEntryId,
      reason:          params.reason,
      idempotencyKey:  `reverse_${params.redemptionEntryId}`,
    });
    this.logger.warn(`Redemption ${params.redemptionEntryId} reversed: ${params.reason}`);
    return { reversal_id: reversal.id };
  }
}
