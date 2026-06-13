import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../../node_modules/.prisma/client-tenant';
import type { PrismaClient as TenantPrismaClient } from '../../node_modules/.prisma/client-tenant';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import {
  TopUpWalletDto,
  AdjustWalletDto,
  UpsertLoyaltyConfigDto,
} from './dto';
import { getTenantGymId } from '../common/tenant-context';

type Tx = Prisma.TransactionClient;

@Injectable()
export class WalletService {
  constructor(private tenant: TenantPrisma) {}

  // ── Wallet basics ─────────────────────────────────────────────

  /** Returns the member's wallet, creating an empty one on first access. */
  async getOrCreateWallet(memberId: string, client: Tx | TenantPrismaClient = this.tenant.client) {
    const existing = await (client as any).wallet.findUnique({ where: { member_id: memberId } });
    if (existing) return existing;
    return (client as any).wallet.create({
      data: { gym_id: getTenantGymId()!, member_id: memberId },
    });
  }

  async getWallet(memberId: string) {
    const member = await this.tenant.client.member.findUnique({
      where: { id: memberId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found');
    return this.getOrCreateWallet(memberId);
  }

  async getTransactions(memberId: string, page = 1, limit = 50) {
    const wallet = await this.tenant.client.wallet.findUnique({ where: { member_id: memberId } });
    if (!wallet) return { data: [], total: 0, page, limit };
    const safeLimit = Math.min(limit, 200);
    const skip = (page - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.tenant.client.walletTransaction.findMany({
        where: { wallet_id: wallet.id },
        orderBy: { created_at: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.tenant.client.walletTransaction.count({ where: { wallet_id: wallet.id } }),
    ]);
    return { data, total, page, limit };
  }

  async topUp(dto: TopUpWalletDto) {
    return this.tenant.client.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(dto.member_id, tx);
      return this.applyMovement(tx, wallet.id, {
        type: 'topup',
        amount: dto.amount,
        points: 0,
        notes: dto.notes,
        created_by: dto.created_by,
      });
    });
  }

  async adjust(dto: AdjustWalletDto) {
    if (!dto.amount && !dto.points) {
      throw new BadRequestException('Provide an amount and/or points to adjust');
    }
    return this.tenant.client.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(dto.member_id, tx);
      return this.applyMovement(tx, wallet.id, {
        type: 'adjustment',
        amount: dto.amount ?? 0,
        points: dto.points ?? 0,
        notes: dto.notes,
        created_by: dto.created_by,
      });
    });
  }

  // ── Used by POS inside its transaction ────────────────────────

  /**
   * Debits `amount` of stored value from the member's wallet for a purchase.
   * Throws if the balance is insufficient. Returns the wallet transaction.
   */
  async debitForPurchase(
    tx: Tx,
    memberId: string,
    amount: number,
    referenceId: string,
  ) {
    const wallet = await this.getOrCreateWallet(memberId, tx);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance: available ${Number(wallet.balance)}, required ${amount}`,
      );
    }
    return this.applyMovement(tx, wallet.id, {
      type: 'purchase',
      amount: -amount,
      points: 0,
      reference_id: referenceId,
      reference_type: 'pos_sale',
    });
  }

  /** Credits earned loyalty points for a purchase. Returns points earned (0 if loyalty off). */
  async earnPoints(tx: Tx, memberId: string, spendAmount: number, referenceId: string): Promise<number> {
    const config = await this.getActiveConfig(tx);
    if (!config) return 0;
    const points = Math.floor(spendAmount * Number(config.points_per_currency));
    if (points <= 0) return 0;
    const wallet = await this.getOrCreateWallet(memberId, tx);
    await this.applyMovement(tx, wallet.id, {
      type: 'points_earn',
      amount: 0,
      points,
      reference_id: referenceId,
      reference_type: 'pos_sale',
    });
    return points;
  }

  /**
   * Redeems `points` toward a purchase. Validates against config (active, min redeem,
   * sufficient balance) and returns the currency discount value the points are worth.
   */
  async redeemPoints(
    tx: Tx,
    memberId: string,
    points: number,
    referenceId?: string,
  ): Promise<number> {
    if (points <= 0) return 0;
    const config = await this.getActiveConfig(tx);
    if (!config) throw new BadRequestException('Loyalty program is not active');
    if (points < config.min_redeem_points) {
      throw new BadRequestException(`Minimum ${config.min_redeem_points} points required to redeem`);
    }
    const wallet = await this.getOrCreateWallet(memberId, tx);
    if (wallet.points_balance < points) {
      throw new BadRequestException(
        `Insufficient points: available ${wallet.points_balance}, requested ${points}`,
      );
    }
    await this.applyMovement(tx, wallet.id, {
      type: 'points_redeem',
      amount: 0,
      points: -points,
      reference_id: referenceId,
      reference_type: 'pos_sale',
    });
    return points * Number(config.redeem_value_per_point);
  }

  /** Money value of N points under the active config (for previewing a redemption). */
  async pointsToCurrency(points: number): Promise<number> {
    const config = await this.getActiveConfig(this.tenant.client);
    if (!config) return 0;
    return points * Number(config.redeem_value_per_point);
  }

  // ── Loyalty config ────────────────────────────────────────────

  async getActiveConfig(client: Tx | TenantPrismaClient = this.tenant.client) {
    const gymId = getTenantGymId()!;
    const config = await (client as any).loyaltyConfig.findUnique({ where: { gym_id: gymId } });
    return config && config.is_active ? config : null;
  }

  async getConfig() {
    const gymId = getTenantGymId()!;
    return this.tenant.client.loyaltyConfig.findUnique({ where: { gym_id: gymId } });
  }

  async upsertConfig(dto: UpsertLoyaltyConfigDto) {
    const gymId = getTenantGymId()!;
    return this.tenant.client.loyaltyConfig.upsert({
      where: { gym_id: gymId },
      create: {
        gym_id: gymId,
        is_active: dto.is_active ?? false,
        points_per_currency: dto.points_per_currency ?? 1,
        redeem_value_per_point: dto.redeem_value_per_point ?? 1,
        min_redeem_points: dto.min_redeem_points ?? 0,
      },
      update: {
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.points_per_currency !== undefined && { points_per_currency: dto.points_per_currency }),
        ...(dto.redeem_value_per_point !== undefined && { redeem_value_per_point: dto.redeem_value_per_point }),
        ...(dto.min_redeem_points !== undefined && { min_redeem_points: dto.min_redeem_points }),
      },
    });
  }

  // ── internal ──────────────────────────────────────────────────

  /**
   * Applies a money/points delta to a wallet and records the ledger row with the
   * resulting balances. Guards against negative balances. Runs inside the caller's tx.
   */
  private async applyMovement(
    tx: Tx,
    walletId: string,
    mv: {
      type: string;
      amount: number;
      points: number;
      reference_id?: string;
      reference_type?: string;
      notes?: string;
      created_by?: string;
    },
  ) {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const newBalance = Number(wallet.balance) + mv.amount;
    const newPoints = wallet.points_balance + mv.points;
    if (newBalance < 0) throw new BadRequestException('Wallet balance cannot go negative');
    if (newPoints < 0) throw new BadRequestException('Points balance cannot go negative');

    await tx.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance, points_balance: newPoints },
    });

    return tx.walletTransaction.create({
      data: {
        gym_id: getTenantGymId()!,
        wallet_id: walletId,
        type: mv.type,
        amount: mv.amount,
        points: mv.points,
        balance_after: newBalance,
        points_after: newPoints,
        reference_id: mv.reference_id,
        reference_type: mv.reference_type,
        notes: mv.notes,
        created_by: mv.created_by,
      },
    });
  }
}
