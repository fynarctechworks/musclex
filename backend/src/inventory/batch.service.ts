import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto, AdjustBatchDto } from './dto';
import { getTenantGymId } from '../common/tenant-context';

/**
 * A Prisma transaction client — the subset of the client available inside $transaction.
 * FIFO deduction must run inside the caller's transaction so batch + aggregate stock
 * move atomically with the sale.
 */
type Tx = Prisma.TransactionClient;

@Injectable()
export class BatchService {
  constructor(private prisma: PrismaService) {}

  // ── Batch CRUD ────────────────────────────────────────────────

  /**
   * Receives a new batch. Bumps the product's aggregate Inventory.stock_quantity so the
   * fast-path aggregate (used everywhere for display + non-tracked sales) stays in sync
   * with the sum of batch quantities. Both writes happen in one transaction.
   */
  async createBatch(dto: CreateBatchDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.product_id },
      select: { id: true, product_name: true, track_batches: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.create({
        data: {
          gym_id: getTenantGymId()!,
          product_id: dto.product_id,
          branch_id: dto.branch_id,
          batch_number: dto.batch_number,
          quantity: dto.quantity,
          cost_price: dto.cost_price ?? 0,
          expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
          supplier_id: dto.supplier_id,
          status: 'active',
        },
      });

      await this.syncAggregateStock(tx, dto.product_id, dto.branch_id, dto.quantity);

      await tx.inventoryTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          product_id: dto.product_id,
          branch_id: dto.branch_id,
          transaction_type: 'purchase',
          quantity: dto.quantity,
          reference_id: batch.id,
          notes: `Batch ${dto.batch_number} received`,
        },
      });

      return batch;
    });
  }

  async findBatches(filters: {
    product_id?: string;
    branch_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { product_id, branch_id, status, page = 1, limit = 50 } = filters;
    const safeLimit = Math.min(limit, 500);
    const skip = (page - 1) * safeLimit;
    const where: any = {};
    if (product_id) where.product_id = product_id;
    if (branch_id) where.branch_id = branch_id;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.productBatch.findMany({
        where,
        skip,
        take: safeLimit,
        // Earliest expiry first (NULLS LAST) — same order FIFO consumes them.
        orderBy: [{ expiry_date: { sort: 'asc', nulls: 'last' } }, { received_at: 'asc' }],
        include: {
          product: { select: { id: true, product_name: true, sku: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.productBatch.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Manual batch adjustment — damage, expiry write-off, correction. Keeps the aggregate
   * Inventory in step. Negative quantity reduces; cannot drive a batch below zero.
   */
  async adjustBatch(batchId: string, dto: AdjustBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.findUnique({ where: { id: batchId } });
      if (!batch) throw new NotFoundException('Batch not found');

      const newQty = batch.quantity + dto.quantity;
      if (newQty < 0) {
        throw new BadRequestException(
          `Adjustment would drive batch below zero (current ${batch.quantity}, delta ${dto.quantity})`,
        );
      }

      const updated = await tx.productBatch.update({
        where: { id: batchId },
        data: {
          quantity: newQty,
          status: newQty === 0 ? 'depleted' : batch.status === 'depleted' ? 'active' : batch.status,
        },
      });

      await this.syncAggregateStock(tx, batch.product_id, batch.branch_id, dto.quantity);

      await tx.inventoryTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          product_id: batch.product_id,
          branch_id: batch.branch_id,
          transaction_type: dto.quantity < 0 ? 'damage' : 'adjustment',
          quantity: dto.quantity,
          reference_id: batchId,
          notes: dto.reason ?? `Batch ${batch.batch_number} adjustment`,
        },
      });

      return updated;
    });
  }

  /**
   * Batches expiring within `daysAhead` days (default 30), plus already-expired active
   * batches. Two-column / date comparison pushed to the DB via the ordered query.
   */
  async getExpiringBatches(filters: { branch_id?: string; days_ahead?: number }) {
    const { branch_id, days_ahead = 30 } = filters;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days_ahead);

    const where: any = {
      status: 'active',
      quantity: { gt: 0 },
      expiry_date: { not: null, lte: cutoff },
    };
    if (branch_id) where.branch_id = branch_id;

    const batches = await this.prisma.productBatch.findMany({
      where,
      orderBy: [{ expiry_date: 'asc' }],
      include: {
        product: { select: { id: true, product_name: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return batches.map((b) => {
      const exp = b.expiry_date!;
      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
      return { ...b, days_until_expiry: daysLeft, is_expired: daysLeft < 0 };
    });
  }

  // ── FIFO deduction (called by POS inside its transaction) ─────────

  /**
   * Deducts `quantity` of a batch-tracked product from its active, non-expired batches
   * in FIFO (earliest-expiry-first) order, within the caller's transaction. Blocks expired
   * stock. Logs one inventory_transaction per batch touched, plus decrements the aggregate
   * Inventory row. Returns the first (primary) batch_id consumed for the sale line.
   *
   * Throws BadRequestException if usable (non-expired) stock is insufficient.
   */
  async deductFifo(
    tx: Tx,
    args: { product_id: string; product_name: string; branch_id: string; quantity: number; reference_id: string },
  ): Promise<string | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Lock candidate batches FOR UPDATE so concurrent sales can't double-spend a batch.
    // Raw SQL: tables live in studio_template and are tenant-scoped by gym_id (raw SQL
    // bypasses the gym_id-injection extension), so we filter gym_id explicitly.
    const gymId = getTenantGymId()!;
    const rows = await tx.$queryRaw<Array<{ id: string; quantity: number; expiry_date: Date | null }>>`
      SELECT id, quantity, expiry_date
      FROM "studio_template"."product_batches"
      WHERE gym_id = ${gymId}::uuid
        AND product_id = ${args.product_id}::uuid
        AND branch_id = ${args.branch_id}::uuid
        AND status = 'active'
        AND quantity > 0
        AND (expiry_date IS NULL OR expiry_date >= ${today})
      ORDER BY expiry_date ASC NULLS LAST, received_at ASC
      FOR UPDATE
    `;

    const usable = rows.reduce((s, r) => s + r.quantity, 0);
    if (usable < args.quantity) {
      throw new BadRequestException(
        `Insufficient non-expired stock for "${args.product_name}": available ${usable}, requested ${args.quantity}`,
      );
    }

    let remaining = args.quantity;
    let primaryBatchId: string | null = null;

    for (const batch of rows) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      const newQty = batch.quantity - take;

      await tx.productBatch.update({
        where: { id: batch.id },
        data: { quantity: newQty, status: newQty === 0 ? 'depleted' : 'active' },
      });

      await tx.inventoryTransaction.create({
        data: {
          gym_id: gymId,
          product_id: args.product_id,
          branch_id: args.branch_id,
          transaction_type: 'sale',
          quantity: -take,
          reference_id: args.reference_id,
          notes: `FIFO batch ${batch.id}`,
        },
      });

      if (!primaryBatchId) primaryBatchId = batch.id;
      remaining -= take;
    }

    // Keep aggregate Inventory in step with the sum of batch quantities.
    await this.syncAggregateStock(tx, args.product_id, args.branch_id, -args.quantity);

    return primaryBatchId;
  }

  // ── internal ──────────────────────────────────────────────────

  /**
   * Adjusts the aggregate Inventory.stock_quantity by `delta`. Creates the Inventory row if
   * a batch arrives for a product that never had one. Never goes below zero.
   */
  private async syncAggregateStock(tx: Tx, productId: string, branchId: string, delta: number) {
    const key = { product_id_branch_id: { product_id: productId, branch_id: branchId } };
    const inv = await tx.inventory.findUnique({ where: key });
    if (!inv) {
      await tx.inventory.create({
        data: {
          gym_id: getTenantGymId()!,
          product_id: productId,
          branch_id: branchId,
          stock_quantity: Math.max(0, delta),
        },
      });
      return;
    }
    const next = Math.max(0, inv.stock_quantity + delta);
    await tx.inventory.update({
      where: key,
      data: { stock_quantity: next, last_updated: new Date() },
    });
  }
}
