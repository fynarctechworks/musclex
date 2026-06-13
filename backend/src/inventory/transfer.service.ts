import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../../node_modules/.prisma/client-tenant';
import type { PrismaClient as TenantPrismaClient } from '../../node_modules/.prisma/client-tenant';
import { randomBytes } from 'crypto';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import {
  CreateTransferDto,
  ReceiveTransferDto,
  UpsertBranchPriceDto,
} from './dto';
import { getTenantGymId } from '../common/tenant-context';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TransferService {
  constructor(private tenant: TenantPrisma) {}

  private generateTransferNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = randomBytes(4).toString('hex').toUpperCase();
    return `TRF-${date}-${seq}`;
  }

  // ── Stock transfers ───────────────────────────────────────────

  /**
   * Creates a transfer and immediately dispatches it: stock leaves the source branch now
   * (status -> in_transit), arrives at destination on receive. Batch-tracked products
   * consume source batches FIFO and snapshot batch_number/expiry onto each line so the
   * destination can recreate the batch with the same expiry.
   */
  async createTransfer(dto: CreateTransferDto) {
    if (dto.from_branch_id === dto.to_branch_id) {
      throw new BadRequestException('Source and destination branches must differ');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Transfer must contain at least one item');
    }

    const productIds = dto.items.map((i) => i.product_id);
    const products = await this.tenant.client.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, product_name: true, track_batches: true },
    });
    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException('One or more products not found');
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    const gymId = getTenantGymId()!;
    const transferNumber = this.generateTransferNumber();

    return this.tenant.client.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          gym_id: gymId,
          transfer_number: transferNumber,
          from_branch_id: dto.from_branch_id,
          to_branch_id: dto.to_branch_id,
          status: 'in_transit',
          notes: dto.notes,
          initiated_by: dto.initiated_by,
          dispatched_at: new Date(),
        },
      });

      for (const item of dto.items) {
        const product = productMap.get(item.product_id)!;

        if (product.track_batches) {
          // Consume source batches FIFO; one transfer item per batch consumed.
          await this.dispatchBatched(tx, {
            transferId: transfer.id,
            gymId,
            product_id: item.product_id,
            product_name: product.product_name,
            from_branch_id: dto.from_branch_id,
            quantity: item.quantity,
          });
        } else {
          // Aggregate decrement at source, oversell-guarded.
          const result = await tx.inventory.updateMany({
            where: {
              product_id: item.product_id,
              branch_id: dto.from_branch_id,
              stock_quantity: { gte: item.quantity },
            },
            data: { stock_quantity: { decrement: item.quantity }, last_updated: new Date() },
          });
          if (result.count !== 1) {
            const cur = await tx.inventory.findUnique({
              where: {
                product_id_branch_id: {
                  product_id: item.product_id,
                  branch_id: dto.from_branch_id,
                },
              },
              select: { stock_quantity: true },
            });
            throw new BadRequestException(
              `Insufficient stock for "${product.product_name}" at source branch: available ${cur?.stock_quantity ?? 0}, requested ${item.quantity}`,
            );
          }
          await tx.stockTransferItem.create({
            data: {
              gym_id: gymId,
              transfer_id: transfer.id,
              product_id: item.product_id,
              quantity: item.quantity,
            },
          });
          await tx.inventoryTransaction.create({
            data: {
              gym_id: gymId,
              product_id: item.product_id,
              branch_id: dto.from_branch_id,
              transaction_type: 'transfer_out',
              quantity: -item.quantity,
              reference_id: transfer.id,
            },
          });
        }
      }

      return this.findOne(transfer.id, tx);
    });
  }

  /**
   * Consume `quantity` FIFO from a batch-tracked product's source batches, recording one
   * StockTransferItem per batch with its batch_number + expiry, and a transfer_out txn.
   * Locks rows FOR UPDATE so concurrent dispatches can't double-spend a batch.
   */
  private async dispatchBatched(
    tx: Tx,
    args: {
      transferId: string;
      gymId: string;
      product_id: string;
      product_name: string;
      from_branch_id: string;
      quantity: number;
    },
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await tx.$queryRaw<
      Array<{ id: string; quantity: number; batch_number: string; expiry_date: Date | null }>
    >`
      SELECT id, quantity, batch_number, expiry_date
      FROM "product_batches"
      WHERE gym_id = ${args.gymId}::uuid
        AND product_id = ${args.product_id}::uuid
        AND branch_id = ${args.from_branch_id}::uuid
        AND status = 'active'
        AND quantity > 0
        AND (expiry_date IS NULL OR expiry_date >= ${today})
      ORDER BY expiry_date ASC NULLS LAST, received_at ASC
      FOR UPDATE
    `;

    const usable = rows.reduce((s, r) => s + r.quantity, 0);
    if (usable < args.quantity) {
      throw new BadRequestException(
        `Insufficient non-expired stock for "${args.product_name}" at source branch: available ${usable}, requested ${args.quantity}`,
      );
    }

    let remaining = args.quantity;
    for (const batch of rows) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      const newQty = batch.quantity - take;

      await tx.productBatch.update({
        where: { id: batch.id },
        data: { quantity: newQty, status: newQty === 0 ? 'depleted' : 'active' },
      });

      await tx.stockTransferItem.create({
        data: {
          gym_id: args.gymId,
          transfer_id: args.transferId,
          product_id: args.product_id,
          source_batch_id: batch.id,
          batch_number: batch.batch_number,
          expiry_date: batch.expiry_date,
          quantity: take,
        },
      });

      remaining -= take;
    }

    // Aggregate source inventory + audit log.
    await this.adjustAggregate(tx, args.product_id, args.from_branch_id, -args.quantity);
    await tx.inventoryTransaction.create({
      data: {
        gym_id: args.gymId,
        product_id: args.product_id,
        branch_id: args.from_branch_id,
        transaction_type: 'transfer_out',
        quantity: -args.quantity,
        reference_id: args.transferId,
      },
    });
  }

  /**
   * Receives an in-transit transfer at the destination: increments destination inventory,
   * and for batch lines recreates a batch at the destination preserving batch_number/expiry.
   */
  async receiveTransfer(id: string, dto: ReceiveTransferDto) {
    const transfer = await this.tenant.client.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== 'in_transit') {
      throw new BadRequestException(`Cannot receive a transfer in status "${transfer.status}"`);
    }

    const gymId = getTenantGymId()!;

    return this.tenant.client.$transaction(async (tx) => {
      for (const item of transfer.items) {
        if (item.source_batch_id) {
          // Recreate the batch at the destination with the same identity/expiry.
          await tx.productBatch.create({
            data: {
              gym_id: gymId,
              product_id: item.product_id,
              branch_id: transfer.to_branch_id,
              batch_number: item.batch_number ?? `TRF-${transfer.transfer_number}`,
              quantity: item.quantity,
              expiry_date: item.expiry_date,
              status: 'active',
            },
          });
        }
        await this.adjustAggregate(tx, item.product_id, transfer.to_branch_id, item.quantity);
        await tx.inventoryTransaction.create({
          data: {
            gym_id: gymId,
            product_id: item.product_id,
            branch_id: transfer.to_branch_id,
            transaction_type: 'transfer_in',
            quantity: item.quantity,
            reference_id: transfer.id,
          },
        });
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'received', received_at: new Date(), received_by: dto.received_by },
      });

      return this.findOne(id, tx);
    });
  }

  /**
   * Cancels an in-transit transfer: returns dispatched stock to the source branch.
   * Batch lines are restored to a batch at source (same number/expiry).
   */
  async cancelTransfer(id: string) {
    const transfer = await this.tenant.client.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status === 'received') {
      throw new BadRequestException('Cannot cancel a received transfer');
    }
    if (transfer.status === 'cancelled') {
      throw new BadRequestException('Transfer already cancelled');
    }

    const gymId = getTenantGymId()!;

    return this.tenant.client.$transaction(async (tx) => {
      for (const item of transfer.items) {
        if (item.source_batch_id) {
          await tx.productBatch.create({
            data: {
              gym_id: gymId,
              product_id: item.product_id,
              branch_id: transfer.from_branch_id,
              batch_number: item.batch_number ?? `TRF-${transfer.transfer_number}-RET`,
              quantity: item.quantity,
              expiry_date: item.expiry_date,
              status: 'active',
            },
          });
        }
        await this.adjustAggregate(tx, item.product_id, transfer.from_branch_id, item.quantity);
        await tx.inventoryTransaction.create({
          data: {
            gym_id: gymId,
            product_id: item.product_id,
            branch_id: transfer.from_branch_id,
            transaction_type: 'transfer_in',
            quantity: item.quantity,
            reference_id: transfer.id,
            notes: 'Transfer cancelled — stock returned to source',
          },
        });
      }

      await tx.stockTransfer.update({ where: { id }, data: { status: 'cancelled' } });
      return this.findOne(id, tx);
    });
  }

  async findAll(filters: {
    from_branch_id?: string;
    to_branch_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { from_branch_id, to_branch_id, status, page = 1, limit = 50 } = filters;
    const safeLimit = Math.min(limit, 200);
    const skip = (page - 1) * safeLimit;
    const where: any = {};
    if (from_branch_id) where.from_branch_id = from_branch_id;
    if (to_branch_id) where.to_branch_id = to_branch_id;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.tenant.client.stockTransfer.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
        include: {
          from_branch: { select: { id: true, name: true } },
          to_branch: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.tenant.client.stockTransfer.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, client: Tx | TenantPrismaClient = this.tenant.client) {
    const transfer = await (client as any).stockTransfer.findUnique({
      where: { id },
      include: {
        from_branch: { select: { id: true, name: true } },
        to_branch: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, product_name: true, sku: true } } },
        },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  // ── Per-branch pricing ────────────────────────────────────────

  async upsertBranchPrice(dto: UpsertBranchPriceDto) {
    const gymId = getTenantGymId()!;
    const product = await this.tenant.client.product.findUnique({ where: { id: dto.product_id } });
    if (!product) throw new NotFoundException('Product not found');

    return this.tenant.client.branchProductPrice.upsert({
      where: {
        product_id_branch_id: { product_id: dto.product_id, branch_id: dto.branch_id },
        // Explicit tenant scope (Prisma extendedWhereUnique) — registered tenant model.
        gym_id: gymId,
      },
      create: {
        gym_id: gymId,
        product_id: dto.product_id,
        branch_id: dto.branch_id,
        price: dto.price,
        tax_rate: dto.tax_rate,
      },
      update: { price: dto.price, tax_rate: dto.tax_rate },
    });
  }

  async getBranchPrices(productId: string) {
    return this.tenant.client.branchProductPrice.findMany({
      where: { product_id: productId },
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  async deleteBranchPrice(productId: string, branchId: string) {
    const existing = await this.tenant.client.branchProductPrice.findUnique({
      where: { product_id_branch_id: { product_id: productId, branch_id: branchId } },
    });
    if (!existing) throw new NotFoundException('Branch price override not found');
    await this.tenant.client.branchProductPrice.delete({
      where: { product_id_branch_id: { product_id: productId, branch_id: branchId } },
    });
    return { deleted: true };
  }

  // ── internal ──────────────────────────────────────────────────

  /** Adjust the per-branch aggregate Inventory by delta, creating the row if absent. */
  private async adjustAggregate(tx: Tx, productId: string, branchId: string, delta: number) {
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
    await tx.inventory.update({
      where: key,
      data: { stock_quantity: Math.max(0, inv.stock_quantity + delta), last_updated: new Date() },
    });
  }
}
