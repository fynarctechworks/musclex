import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction, PaymentStatus, Prisma } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { RecordPaymentDto, PaymentFilterDto } from './dto/billing.dto';

const MAX_RETRIES = 3;

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
  ) {}

  async findAll(filters: PaymentFilterDto) {
    const where: Prisma.PaymentWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.gateway) where.gateway = filters.gateway;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return new PaginatedResult(data, total, filters.page!, filters.limit!);
  }

  async recordPayment(dto: RecordPaymentDto, ctx: AuditContext) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenant_id },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const payment = await this.prisma.payment.create({
      data: {
        tenant_id: dto.tenant_id,
        amount: dto.amount,
        currency: dto.currency || 'INR',
        status: PaymentStatus.PAID,
        gateway: dto.gateway || 'manual',
        gateway_payment_id: dto.gateway_payment_id,
      },
    });

    await this.audit.log(AuditAction.CREATE, 'payment', payment.id, ctx, {
      new_value: { tenant: tenant.name, amount: dto.amount },
    });

    return payment;
  }

  async retryPayment(id: string, ctx: AuditContext) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException('Only failed payments can be retried');
    }
    if (payment.retry_count >= MAX_RETRIES) {
      throw new BadRequestException(`Max retries (${MAX_RETRIES}) exceeded`);
    }

    // In production, this would call the payment gateway.
    // For now, mark as pending and increment retry count.
    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.PENDING,
        retry_count: { increment: 1 },
      },
    });

    await this.audit.log(AuditAction.PAYMENT_RETRY, 'payment', id, ctx, {
      metadata: { retry_count: updated.retry_count },
    });

    return updated;
  }

  async markAsPaid(id: string, ctx: AuditContext) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Payment is already marked as paid');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.PAID },
    });

    await this.audit.log(AuditAction.UPDATE, 'payment', id, ctx, {
      old_value: { status: payment.status },
      new_value: { status: 'PAID' },
    });

    return updated;
  }

  async refund(id: string, ctx: AuditContext) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Only paid payments can be refunded');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.REFUNDED },
    });

    await this.audit.log(AuditAction.REFUND, 'payment', id, ctx, {
      metadata: { amount: payment.amount, currency: payment.currency },
    });

    return updated;
  }
}
