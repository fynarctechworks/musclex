import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePosSaleDto, CreateProductReturnDto } from './dto';
import { randomBytes } from 'crypto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  private generateInvoiceNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = randomBytes(4).toString('hex').toUpperCase();
    return `POS-${date}-${seq}`;
  }

  async createSale(dto: CreatePosSaleDto) {
    // Look up all products and compute totals
    const productIds = dto.items.map((i) => i.product_id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: 'active' },
      include: { inventory: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate all products exist and have sufficient stock
    for (const item of dto.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new NotFoundException(`Product ${item.product_id} not found or inactive`);
      }
      if (product.inventory && product.inventory.stock_quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.product_name}": available ${product.inventory.stock_quantity}, requested ${item.quantity}`,
        );
      }
    }

    // Calculate line items
    const lineItems = dto.items.map((item) => {
      const product = productMap.get(item.product_id)!;
      const unitPrice = Number(product.price);
      const taxRate = Number(product.tax_rate);
      const lineSubtotal = unitPrice * item.quantity;
      const lineTax = lineSubtotal * (taxRate / 100);
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        tax_amount: lineTax,
        total_price: lineSubtotal + lineTax,
      };
    });

    const subtotal = lineItems.reduce((s, l) => s + l.unit_price * l.quantity, 0);
    const taxAmount = lineItems.reduce((s, l) => s + l.tax_amount, 0);
    const discountAmount = dto.discount_amount ?? 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    if (totalAmount < 0) {
      throw new BadRequestException('Total amount cannot be negative');
    }

    const invoiceNumber = this.generateInvoiceNumber();

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.posSale.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: dto.branch_id,
          member_id: dto.member_id,
          staff_id: dto.staff_id,
          invoice_number: invoiceNumber,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          payment_method: dto.payment_method,
          status: 'completed',
          items: {
            create: lineItems.map((item) => ({ ...item, gym_id: getTenantGymId()! })),
          },
        },
        include: {
          items: { include: { product: { select: { id: true, product_name: true, sku: true } } } },
          member: { select: { id: true, full_name: true } },
          staff: { select: { id: true, full_name: true } },
        },
      });

      // Deduct stock and log transactions
      for (const item of dto.items) {
        const product = productMap.get(item.product_id)!;
        if (product.inventory) {
          await tx.inventory.update({
            where: { product_id: item.product_id },
            data: {
              stock_quantity: { decrement: item.quantity },
              last_updated: new Date(),
            },
          });
        }
        await tx.inventoryTransaction.create({
          data: {
            gym_id: getTenantGymId()!,
            product_id: item.product_id,
            branch_id: dto.branch_id,
            transaction_type: 'sale',
            quantity: -item.quantity,
            reference_id: sale.id,
          },
        });
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

      // Restore stock
      await tx.inventory.update({
        where: { product_id: dto.product_id },
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
