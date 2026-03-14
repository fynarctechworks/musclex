import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto';
import { randomInt } from 'crypto';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  private generateInvoiceNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomInt(1000, 9999);
    return `INV-${date}-${rand}`;
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const member = await this.prisma.member.findUnique({ where: { id: dto.member_id } });
    if (!member) throw new NotFoundException('Member not found');

    // Calculate subtotal from items
    const items = dto.items.map((item) => ({
      item_type: item.item_type,
      item_id: item.item_id,
      description: item.description,
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price,
      total_price: item.unit_price * (item.quantity ?? 1),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);

    // Resolve discount code to ID if needed
    let discountId = dto.discount_id;
    if (dto.discount_code && !discountId) {
      const discount = await this.prisma.discount.findUnique({
        where: { code: dto.discount_code },
      });
      if (discount) discountId = discount.id;
    }

    // Wrap everything in a transaction (discount validation + invoice creation)
    const invoice = await this.prisma.$transaction(async (tx) => {
      let discountAmount = 0;

      if (discountId) {
        const discount = await tx.discount.findUnique({ where: { id: discountId } });
        if (discount && discount.is_active) {
          const now = new Date();
          const validFrom = new Date(discount.valid_from);
          const validUntil = discount.valid_until ? new Date(discount.valid_until) : null;

          if (now >= validFrom && (!validUntil || now <= validUntil)) {
            if (discount.max_uses && discount.used_count >= discount.max_uses) {
              throw new BadRequestException('Discount has reached maximum uses');
            }
            if (discount.min_purchase && subtotal < Number(discount.min_purchase)) {
              throw new BadRequestException(`Minimum purchase of ${discount.min_purchase} required`);
            }

            if (discount.discount_type === 'percentage') {
              discountAmount = subtotal * (Number(discount.value) / 100);
              if (discount.max_discount && discountAmount > Number(discount.max_discount)) {
                discountAmount = Number(discount.max_discount);
              }
            } else {
              discountAmount = Number(discount.value);
            }

            // Increment used_count atomically inside transaction
            await tx.discount.update({
              where: { id: discountId },
              data: { used_count: { increment: 1 } },
            });
          }
        }
      }

      // Calculate tax
      let taxAmount = 0;
      if (dto.tax_rate_id) {
        const taxRate = await tx.taxRate.findUnique({ where: { id: dto.tax_rate_id } });
        if (taxRate && taxRate.is_active) {
          taxAmount = (subtotal - discountAmount) * (Number(taxRate.rate) / 100);
        }
      }

      const totalAmount = subtotal - discountAmount + taxAmount;

      const inv = await tx.memberInvoice.create({
        data: {
          organization_id: dto.organization_id,
          branch_id: dto.branch_id,
          member_id: dto.member_id,
          invoice_number: this.generateInvoiceNumber(),
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          status: 'pending',
          due_date: dto.due_date ? new Date(dto.due_date) : null,
          notes: dto.notes,
          discount_id: discountId,
          tax_rate_id: dto.tax_rate_id,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
          member: { select: { id: true, full_name: true, member_code: true, email: true, phone: true } },
          branch: { select: { id: true, name: true } },
          discount: { select: { id: true, name: true, code: true, discount_type: true, value: true } },
          tax_rate: { select: { id: true, tax_name: true, rate: true } },
        },
      });

      // Record financial transaction (credit = receivable)
      await tx.financialTransaction.create({
        data: {
          branch_id: dto.branch_id,
          reference_type: 'invoice',
          reference_id: inv.id,
          transaction_type: 'credit',
          amount: totalAmount,
          description: `Invoice ${inv.invoice_number} issued`,
        },
      });

      return inv;
    });

    return invoice;
  }

  async findAllInvoices(filters?: {
    branch_id?: string;
    member_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.branch_id) where.branch_id = filters.branch_id;
    if (filters?.member_id) where.member_id = filters.member_id;
    if (filters?.status) where.status = filters.status;
    if (filters?.date_from || filters?.date_to) {
      where.issued_at = {};
      if (filters?.date_from) where.issued_at.gte = new Date(filters.date_from);
      if (filters?.date_to) where.issued_at.lte = new Date(filters.date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.memberInvoice.findMany({
        where,
        include: {
          items: true,
          member: { select: { id: true, full_name: true, member_code: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { payments: true } },
        },
        skip,
        take: limit,
        orderBy: { issued_at: 'desc' },
      }),
      this.prisma.memberInvoice.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOneInvoice(id: string) {
    const invoice = await this.prisma.memberInvoice.findUnique({
      where: { id },
      include: {
        items: true,
        member: {
          select: { id: true, full_name: true, member_code: true, email: true, phone: true },
        },
        branch: { select: { id: true, name: true, address: true, city: true, phone: true } },
        organization: { select: { id: true, name: true, logo_url: true } },
        discount: { select: { id: true, name: true, code: true, discount_type: true, value: true } },
        tax_rate: { select: { id: true, tax_name: true, rate: true, country: true } },
        payments: {
          select: { id: true, amount: true, payment_method: true, status: true, paid_at: true, receipt_number: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async updateInvoiceStatus(id: string, status: string) {
    const invoice = await this.prisma.memberInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const data: any = { status };
    if (status === 'paid') data.paid_at = new Date();

    return this.prisma.memberInvoice.update({
      where: { id },
      data,
      include: {
        items: true,
        member: { select: { id: true, full_name: true, member_code: true } },
      },
    });
  }

  async cancelInvoice(id: string) {
    const invoice = await this.prisma.memberInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'paid') throw new BadRequestException('Cannot cancel a paid invoice');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.memberInvoice.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // Reverse the financial transaction
      await tx.financialTransaction.create({
        data: {
          branch_id: invoice.branch_id,
          reference_type: 'adjustment',
          reference_id: invoice.id,
          transaction_type: 'debit',
          amount: invoice.total_amount,
          description: `Invoice ${invoice.invoice_number} cancelled`,
        },
      });

      return updated;
    });
  }

  // Check if invoice is fully paid by summing payments
  async recalculateInvoiceStatus(invoiceId: string) {
    const invoice = await this.prisma.memberInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { where: { status: 'paid' } } },
    });
    if (!invoice) return;

    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const totalDue = Number(invoice.total_amount);

    let status = invoice.status;
    if (totalPaid >= totalDue) {
      status = 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    }

    if (status !== invoice.status) {
      await this.prisma.memberInvoice.update({
        where: { id: invoiceId },
        data: {
          status,
          paid_at: status === 'paid' ? new Date() : null,
        },
      });
    }
  }
}
