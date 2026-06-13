import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { ProcessRefundDto } from './dto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class RefundsService {
  constructor(private tenant: TenantPrisma) {}

  async processRefund(dto: ProcessRefundDto) {
    const payment = await this.tenant.client.payment.findUnique({
      where: { id: dto.payment_id },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'paid') throw new BadRequestException('Can only refund paid payments');

    // Validate refund amount
    const existingRefunds = await this.tenant.client.refund.findMany({
      where: { payment_id: dto.payment_id, status: { not: 'failed' } },
    });
    const totalRefunded = existingRefunds.reduce(
      (sum, r) => sum + Number(r.refund_amount),
      0,
    );
    if (totalRefunded + dto.refund_amount > Number(payment.amount)) {
      throw new BadRequestException(
        `Refund amount exceeds remaining refundable amount (${Number(payment.amount) - totalRefunded})`,
      );
    }

    return this.tenant.client.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          gym_id: getTenantGymId()!,
          payment_id: dto.payment_id,
          member_id: payment.member_id,
          refund_amount: dto.refund_amount,
          reason: dto.reason,
          status: 'processed',
          processed_at: new Date(),
          processed_by: dto.processed_by,
        },
        include: {
          payment: { select: { id: true, receipt_number: true, amount: true } },
          member: { select: { id: true, full_name: true, member_code: true } },
          processed_by_staff: { select: { id: true, full_name: true } },
        },
      });

      // Check if full refund → mark payment as refunded
      const newTotalRefunded = totalRefunded + dto.refund_amount;
      if (newTotalRefunded >= Number(payment.amount)) {
        await tx.payment.update({
          where: { id: dto.payment_id },
          data: { status: 'refunded' },
        });
      }

      // Record financial transaction (debit = money leaving)
      await tx.financialTransaction.create({
        data: {
          gym_id: getTenantGymId()!,
          branch_id: payment.branch_id,
          reference_type: 'refund',
          reference_id: refund.id,
          transaction_type: 'debit',
          amount: dto.refund_amount,
          description: `Refund for payment ${payment.receipt_number}${dto.reason ? ': ' + dto.reason : ''}`,
        },
      });

      // Update invoice status if linked
      if (payment.invoice_id) {
        const invoice = await tx.memberInvoice.findUnique({
          where: { id: payment.invoice_id },
        });
        if (invoice && newTotalRefunded >= Number(payment.amount)) {
          await tx.memberInvoice.update({
            where: { id: payment.invoice_id },
            data: { status: 'refunded' },
          });
        }
      }

      return refund;
    });
  }

  async findAllRefunds(filters?: {
    payment_id?: string;
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

    if (filters?.payment_id) where.payment_id = filters.payment_id;
    if (filters?.member_id) where.member_id = filters.member_id;
    if (filters?.status) where.status = filters.status;
    if (filters?.date_from || filters?.date_to) {
      where.created_at = {};
      if (filters?.date_from) where.created_at.gte = new Date(filters.date_from);
      if (filters?.date_to) where.created_at.lte = new Date(filters.date_to);
    }

    const [data, total] = await Promise.all([
      this.tenant.client.refund.findMany({
        where,
        include: {
          payment: { select: { id: true, receipt_number: true, amount: true, payment_method: true } },
          member: { select: { id: true, full_name: true, member_code: true } },
          processed_by_staff: { select: { id: true, full_name: true } },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.tenant.client.refund.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const refund = await this.tenant.client.refund.findUnique({
      where: { id },
      include: {
        payment: {
          select: { id: true, receipt_number: true, amount: true, payment_method: true, member_id: true },
        },
        member: { select: { id: true, full_name: true, member_code: true, email: true } },
        processed_by_staff: { select: { id: true, full_name: true } },
      },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }
}
