import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchService } from './batch.service';
import { BundleService } from './bundle.service';
import { WalletService } from '../wallet/wallet.service';
import { CreatePosSaleDto, CreateProductReturnDto } from './dto';
import { randomBytes } from 'crypto';
import { getTenantGymId } from '../common/tenant-context';

// One resolved PosSaleItem row to insert. A standalone product line has bundle_id=null;
// a bundle expands into N rows that all share the same bundle_id (so the receipt can
// group them) — unit_price for those is the bundle's proportional price split.
interface ResolvedLine {
  product_id: string;
  product_name: string;
  track_batches: boolean;
  bundle_id: string | null;
  hsn_sac: string | null;
  tax_rate: number;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  total_price: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private batchService: BatchService,
    private walletService: WalletService,
    private bundleService: BundleService,
  ) {}

  private generateInvoiceNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = randomBytes(4).toString('hex').toUpperCase();
    return `POS-${date}-${seq}`;
  }

  async createSale(dto: CreatePosSaleDto) {
    // Phase 5: a cart line is either a product (product_id) or a bundle (bundle_id).
    // Resolve both into a single ResolvedLine[] before the transaction.
    for (const item of dto.items) {
      const hasProduct = !!item.product_id;
      const hasBundle = !!item.bundle_id;
      if (hasProduct === hasBundle) {
        throw new BadRequestException(
          'Each cart line must specify exactly one of product_id or bundle_id',
        );
      }
    }

    const productLines = dto.items.filter((i) => i.product_id);
    const bundleLines = dto.items.filter((i) => i.bundle_id);

    // ── Product lines: load products + branch-scoped inventory and price overrides.
    const productIds = productLines.map((i) => i.product_id!);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, status: 'active' },
          include: {
            inventory: { where: { branch_id: dto.branch_id } },
            branch_prices: { where: { branch_id: dto.branch_id } },
          },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of productLines) {
      if (!productMap.get(item.product_id!)) {
        throw new NotFoundException(`Product ${item.product_id} not found or inactive`);
      }
    }

    const resolved: ResolvedLine[] = productLines.map((item) => {
      const product = productMap.get(item.product_id!)!;
      const override = product.branch_prices[0];
      const unitPrice = override ? Number(override.price) : Number(product.price);
      const taxRate =
        override && override.tax_rate != null
          ? Number(override.tax_rate)
          : Number(product.tax_rate);
      const lineSubtotal = unitPrice * item.quantity;
      const lineTax = lineSubtotal * (taxRate / 100);
      return {
        product_id: item.product_id!,
        product_name: product.product_name,
        track_batches: product.track_batches,
        bundle_id: null,
        hsn_sac: null,
        tax_rate: taxRate,
        quantity: item.quantity,
        unit_price: unitPrice,
        tax_amount: lineTax,
        total_price: lineSubtotal + lineTax,
      };
    });

    // ── Bundle lines: pre-validate availability + expand into component rows.
    for (const item of bundleLines) {
      await this.bundleService.checkAvailability(item.bundle_id!, dto.branch_id, item.quantity);
      const { bundle, lines } = await this.bundleService.buildSaleLines(
        item.bundle_id!,
        item.quantity,
      );
      for (const l of lines) {
        resolved.push({
          product_id: l.product_id,
          product_name: l.product_name,
          track_batches: l.track_batches,
          bundle_id: bundle.id,
          hsn_sac: null,
          tax_rate: l.tax_rate,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_amount: l.tax_amount,
          total_price: l.total_price,
        });
      }
    }

    const subtotal = resolved.reduce((s, l) => s + l.unit_price * l.quantity, 0);
    const taxAmount = resolved.reduce((s, l) => s + l.tax_amount, 0);
    const manualDiscount = dto.discount_amount ?? 0;

    // GST split: compare buyer place-of-supply (DTO > member.state if available > branch state)
    // against seller state (branch.gst_state_code > studio.gst_state_code > branch.state > studio.state).
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branch_id },
      select: { state: true, gst_state_code: true, gym_id: true },
    });
    const studio = branch
      ? await this.prisma.studio.findUnique({
          where: { id: branch.gym_id },
          select: { gst_state_code: true, state: true },
        })
      : null;
    const sellerState =
      branch?.gst_state_code || studio?.gst_state_code || branch?.state || studio?.state || null;
    const placeOfSupply =
      (dto as any).place_of_supply || branch?.gst_state_code || branch?.state || null;
    const isInterstate = !!(sellerState && placeOfSupply && sellerState !== placeOfSupply);

    for (const line of resolved) {
      const cgst = isInterstate ? 0 : line.tax_amount / 2;
      const sgst = isInterstate ? 0 : line.tax_amount / 2;
      const igst = isInterstate ? line.tax_amount : 0;
      (line as any).cgst_amount = round2(cgst);
      (line as any).sgst_amount = round2(sgst);
      (line as any).igst_amount = round2(igst);
    }
    const cgstTotal = round2(resolved.reduce((s, l) => s + ((l as any).cgst_amount as number), 0));
    const sgstTotal = round2(resolved.reduce((s, l) => s + ((l as any).sgst_amount as number), 0));
    const igstTotal = round2(resolved.reduce((s, l) => s + ((l as any).igst_amount as number), 0));

    // Phase 4 guards: wallet payment and points redemption both require a member.
    if (dto.payment_method === 'wallet' && !dto.member_id) {
      throw new BadRequestException('Wallet payment requires a member');
    }
    if (dto.redeem_points && !dto.member_id) {
      throw new BadRequestException('Redeeming points requires a member');
    }

    const invoiceNumber = this.generateInvoiceNumber();

    return this.prisma.$transaction(async (tx) => {
      // Points redemption (inside tx so points read+debit are atomic). The redeemed
      // value becomes additional discount, capped so the total never goes negative.
      let pointsRedeemed = 0;
      let redeemDiscount = 0;
      const preRedeemTotal = subtotal + taxAmount - manualDiscount;
      if (dto.redeem_points && dto.member_id) {
        // Redemption happens before the sale row exists, so no sale UUID yet — the
        // ledger records the points_redeem movement without a reference_id.
        const rawValue = await this.walletService.redeemPoints(
          tx,
          dto.member_id,
          dto.redeem_points,
        );
        redeemDiscount = Math.min(rawValue, Math.max(0, preRedeemTotal));
        pointsRedeemed = dto.redeem_points;
      }

      const discountAmount = manualDiscount + redeemDiscount;
      const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);

      const sale = await tx.posSale.create({
        data: ({
          gym_id: getTenantGymId()!,
          branch_id: dto.branch_id,
          member_id: dto.member_id,
          staff_id: dto.staff_id,
          invoice_number: invoiceNumber,
          subtotal,
          tax_amount: taxAmount,
          cgst_amount: cgstTotal,
          sgst_amount: sgstTotal,
          igst_amount: igstTotal,
          place_of_supply: placeOfSupply,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          payment_method: dto.payment_method,
          status: 'completed',
          points_redeemed: pointsRedeemed,
          wallet_amount: dto.payment_method === 'wallet' ? totalAmount : 0,
          items: {
            create: resolved.map((l) => ({
              gym_id: getTenantGymId()!,
              product_id: l.product_id,
              bundle_id: l.bundle_id,
              hsn_sac: l.hsn_sac,
              tax_rate: l.tax_rate,
              cgst_amount: (l as any).cgst_amount,
              sgst_amount: (l as any).sgst_amount,
              igst_amount: (l as any).igst_amount,
              quantity: l.quantity,
              unit_price: l.unit_price,
              tax_amount: l.tax_amount,
              total_price: l.total_price,
            })),
          },
        } as any),
        include: {
          items: { include: { product: { select: { id: true, product_name: true, sku: true } } } },
          member: { select: { id: true, full_name: true } },
          staff: { select: { id: true, full_name: true } },
        },
      });

      // Wallet payment: debit the member's stored balance for the full total.
      if (dto.payment_method === 'wallet' && dto.member_id) {
        await this.walletService.debitForPurchase(tx, dto.member_id, totalAmount, sale.id);
      }

      // Deduct stock and log transactions for every resolved line (product or bundle
      // component). Two paths per line:
      //  - track_batches: FIFO deduction across non-expired batches (deductFifo logs its
      //    own inventory_transaction rows + syncs the aggregate, and returns the primary
      //    batch consumed, which we stamp onto the sale line).
      //  - otherwise: conditional aggregate decrement guarded against oversell — two
      //    concurrent sales of the last unit can't both win (loser matches 0 rows).
      // The same product may appear twice (once standalone + once via a bundle), so we
      // zip resolved[] with sale.items[] by index, not by product_id.
      const saleItems = sale.items;
      for (let i = 0; i < resolved.length; i++) {
        const l = resolved[i];
        const saleItem = saleItems[i];

        if (l.track_batches) {
          const primaryBatchId = await this.batchService.deductFifo(tx, {
            product_id: l.product_id,
            product_name: l.product_name,
            branch_id: dto.branch_id,
            quantity: l.quantity,
            reference_id: sale.id,
          });
          if (primaryBatchId) {
            await tx.posSaleItem.update({
              where: { id: saleItem.id },
              data: { batch_id: primaryBatchId },
            });
          }
          continue;
        }

        const result = await tx.inventory.updateMany({
          where: {
            product_id: l.product_id,
            branch_id: dto.branch_id,
            stock_quantity: { gte: l.quantity },
          },
          data: { stock_quantity: { decrement: l.quantity }, last_updated: new Date() },
        });
        if (result.count !== 1) {
          const current = await tx.inventory.findUnique({
            where: {
              product_id_branch_id: { product_id: l.product_id, branch_id: dto.branch_id },
            },
            select: { stock_quantity: true },
          });
          throw new BadRequestException(
            `Insufficient stock for "${l.product_name}" at this branch: available ${current?.stock_quantity ?? 0}, requested ${l.quantity}`,
          );
        }
        await tx.inventoryTransaction.create({
          data: {
            gym_id: getTenantGymId()!,
            product_id: l.product_id,
            branch_id: dto.branch_id,
            transaction_type: 'sale',
            quantity: -l.quantity,
            reference_id: sale.id,
          },
        });
      }

      // Phase 4: earn loyalty points on the net total for member-linked sales.
      if (dto.member_id) {
        const earned = await this.walletService.earnPoints(
          tx,
          dto.member_id,
          Number(sale.total_amount),
          sale.id,
        );
        if (earned > 0) {
          await tx.posSale.update({ where: { id: sale.id }, data: { points_earned: earned } });
          (sale as any).points_earned = earned;
        }
      }

      return sale;
    });
  }

  async findAllSales(filters: {
    branch_id?: string;
    member_id?: string;
    staff_id?: string;
    payment_method?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, member_id, staff_id, payment_method, status, start_date, end_date, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (branch_id) where.branch_id = branch_id;
    if (member_id) where.member_id = member_id;
    if (staff_id) where.staff_id = staff_id;
    if (payment_method) where.payment_method = payment_method;
    if (status) where.status = status;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [data, total] = await Promise.all([
      this.prisma.posSale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          member: { select: { id: true, full_name: true } },
          staff: { select: { id: true, full_name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.posSale.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOneSale(id: string) {
    const sale = await this.prisma.posSale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, product_name: true, sku: true, barcode: true } },
          },
        },
        member: { select: { id: true, full_name: true, email: true, phone: true } },
        staff: { select: { id: true, full_name: true } },
        branch: { select: { id: true, name: true } },
        returns: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async getDailySalesReport(branchId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await this.prisma.posSale.findMany({
      where: {
        branch_id: branchId,
        status: 'completed',
        created_at: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        items: { include: { product: { select: { id: true, product_name: true } } } },
      },
    });

    const totalRevenue = sales.reduce((s, sale) => s + Number(sale.total_amount), 0);
    const totalTax = sales.reduce((s, sale) => s + Number(sale.tax_amount), 0);
    const totalDiscount = sales.reduce((s, sale) => s + Number(sale.discount_amount), 0);

    // Payment method breakdown
    const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
    for (const sale of sales) {
      if (!paymentBreakdown[sale.payment_method]) {
        paymentBreakdown[sale.payment_method] = { count: 0, amount: 0 };
      }
      paymentBreakdown[sale.payment_method].count++;
      paymentBreakdown[sale.payment_method].amount += Number(sale.total_amount);
    }

    return {
      date: targetDate.toISOString().slice(0, 10),
      branch_id: branchId,
      total_sales: sales.length,
      total_revenue: totalRevenue,
      total_tax: totalTax,
      total_discount: totalDiscount,
      net_revenue: totalRevenue - totalDiscount,
      payment_breakdown: paymentBreakdown,
    };
  }

  async processReturn(dto: CreateProductReturnDto) {
    const sale = await this.prisma.posSale.findUnique({
      where: { id: dto.sale_id },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const saleItem = sale.items.find((i) => i.product_id === dto.product_id);
    if (!saleItem) {
      throw new BadRequestException('Product was not part of this sale');
    }

    // Check return quantity vs sold quantity (account for previous returns)
    const previousReturns = await this.prisma.productReturn.aggregate({
      where: { sale_id: dto.sale_id, product_id: dto.product_id, status: 'approved' },
      _sum: { quantity: true },
    });
    const alreadyReturned = previousReturns._sum.quantity ?? 0;
    if (dto.quantity > saleItem.quantity - alreadyReturned) {
      throw new BadRequestException(
        `Cannot return ${dto.quantity} items. Only ${saleItem.quantity - alreadyReturned} eligible for return.`,
      );
    }

    const unitPrice = Number(saleItem.total_price) / saleItem.quantity;
    const refundAmount = unitPrice * dto.quantity;

    return this.prisma.$transaction(async (tx) => {
      const returnRecord = await tx.productReturn.create({
        data: {
          gym_id: getTenantGymId()!,
          sale_id: dto.sale_id,
          product_id: dto.product_id,
          quantity: dto.quantity,
          refund_amount: refundAmount,
          reason: dto.reason,
          status: 'approved',
          processed_by: dto.processed_by,
        },
        include: {
          product: { select: { id: true, product_name: true } },
          sale: { select: { id: true, invoice_number: true } },
        },
      });

      // Restore aggregate stock at the original sale's branch (per-branch row).
      await tx.inventory.update({
        where: {
          product_id_branch_id: { product_id: dto.product_id, branch_id: sale.branch_id },
        },
        data: {
          stock_quantity: { increment: dto.quantity },
          last_updated: new Date(),
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          product_id: dto.product_id,
          branch_id: sale.branch_id,
          transaction_type: 'return',
          quantity: dto.quantity,
          reference_id: returnRecord.id,
          notes: dto.reason,
        },
      });

      return returnRecord;
    });
  }

  async getTopSellingProducts(filters: {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) {
    const { branch_id, start_date, end_date, limit = 10 } = filters;
    const where: any = { sale: { status: 'completed' } };
    if (branch_id) where.sale = { ...where.sale, branch_id };
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const items = await this.prisma.posSaleItem.groupBy({
      by: ['product_id'],
      where,
      _sum: { quantity: true, total_price: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    // Enrich with product info
    const productIds = items.map((i) => i.product_id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, product_name: true, sku: true, price: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => ({
      product: productMap.get(item.product_id),
      total_quantity_sold: item._sum.quantity,
      total_revenue: item._sum.total_price,
    }));
  }
}
