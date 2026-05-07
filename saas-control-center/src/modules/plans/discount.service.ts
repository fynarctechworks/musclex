import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction } from '@prisma/client';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discount.dto';

@Injectable()
export class DiscountService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
  ) {}

  async findAll(includeExpired = false) {
    const now = new Date();
    return this.prisma.discount.findMany({
      where: includeExpired
        ? {}
        : { is_active: true, valid_to: { gte: now } },
      include: {
        plan: { select: { id: true, name: true } },
      },
      orderBy: { valid_from: 'desc' },
    });
  }

  async create(dto: CreateDiscountDto, ctx: AuditContext) {
    if (dto.code) {
      const existing = await this.prisma.discount.findUnique({
        where: { code: dto.code },
      });
      if (existing) throw new ConflictException('Discount code already exists');
    }

    if (new Date(dto.valid_from) >= new Date(dto.valid_to)) {
      throw new BadRequestException('valid_from must be before valid_to');
    }

    const discount = await this.prisma.discount.create({
      data: {
        name: dto.name,
        plan_id: dto.plan_id,
        type: dto.type,
        value: dto.value,
        code: dto.code,
        valid_from: new Date(dto.valid_from),
        valid_to: new Date(dto.valid_to),
        max_uses: dto.max_uses,
      },
    });

    await this.audit.log(AuditAction.CREATE, 'discount', discount.id, ctx, {
      new_value: discount,
    });

    return discount;
  }

  async update(id: string, dto: UpdateDiscountDto, ctx: AuditContext) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');

    const updated = await this.prisma.discount.update({
      where: { id },
      data: {
        ...dto,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_to: dto.valid_to ? new Date(dto.valid_to) : undefined,
      },
    });

    await this.audit.log(AuditAction.UPDATE, 'discount', id, ctx, {
      old_value: { value: discount.value, is_active: discount.is_active },
      new_value: dto,
    });

    return updated;
  }

  /**
   * Calculates effective price for a plan after applying best active discount.
   */
  async getEffectivePrice(planId: string, billingCycle: 'monthly' | 'yearly') {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const now = new Date();
    const discounts = await this.prisma.discount.findMany({
      where: {
        is_active: true,
        valid_from: { lte: now },
        valid_to: { gte: now },
        OR: [{ plan_id: planId }, { plan_id: null }],
      },
      orderBy: { value: 'desc' },
    });

    const basePrice = billingCycle === 'monthly'
      ? Number(plan.price_monthly)
      : Number(plan.price_yearly);

    // Calculate actual savings for each discount and pick the best
    let bestDiscount: typeof discounts[number] | null = null;
    let bestSavings = 0;

    for (const discount of discounts) {
      // Check max_uses
      if (discount.max_uses !== null && discount.used_count >= discount.max_uses) continue;

      let savings: number;
      if (discount.type === 'PERCENTAGE') {
        savings = basePrice * (Number(discount.value) / 100);
      } else {
        savings = Math.min(Number(discount.value), basePrice);
      }
      if (savings > bestSavings) {
        bestSavings = savings;
        bestDiscount = discount;
      }
    }

    if (!bestDiscount) {
      return { base_price: basePrice, final_price: basePrice, discount: null };
    }

    const finalPrice = Math.max(0, basePrice - bestSavings);

    return {
      base_price: basePrice,
      final_price: Math.round(finalPrice * 100) / 100,
      discount: {
        id: bestDiscount.id,
        name: bestDiscount.name,
        type: bestDiscount.type,
        value: Number(bestDiscount.value),
      },
    };
  }

  // Deactivate expired discounts daily
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async deactivateExpired() {
    await this.prisma.discount.updateMany({
      where: {
        is_active: true,
        valid_to: { lt: new Date() },
      },
      data: { is_active: false },
    });
  }
}
