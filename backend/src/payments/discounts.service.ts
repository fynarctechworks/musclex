import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDiscountDto,
  UpdateDiscountDto,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  CreateGatewayConfigDto,
  UpdateGatewayConfigDto,
} from './dto';

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  // ── Discounts / Coupons ───────────────────────────────────

  async createDiscount(dto: CreateDiscountDto) {
    if (dto.code) {
      const existing = await this.prisma.discount.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Discount code "${dto.code}" already exists`);
    }

    return this.prisma.discount.create({
      data: {
        name: dto.name,
        code: dto.code,
        discount_type: dto.discount_type,
        value: dto.value,
        min_purchase: dto.min_purchase,
        max_discount: dto.max_discount,
        valid_from: new Date(dto.valid_from),
        valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
        max_uses: dto.max_uses,
        applicable_to: dto.applicable_to,
      },
    });
  }

  async findAllDiscounts(filters?: { is_active?: boolean; applicable_to?: string }) {
    const where: any = {};
    if (filters?.is_active !== undefined) where.is_active = filters.is_active;
    if (filters?.applicable_to) where.applicable_to = filters.applicable_to;

    return this.prisma.discount.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneDiscount(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  async validateDiscountCode(code: string) {
    const discount = await this.prisma.discount.findUnique({ where: { code } });
    if (!discount) throw new NotFoundException('Invalid discount code');
    if (!discount.is_active) throw new NotFoundException('Discount is no longer active');

    const now = new Date();
    if (now < new Date(discount.valid_from)) throw new NotFoundException('Discount is not yet valid');
    if (discount.valid_until && now > new Date(discount.valid_until)) {
      throw new NotFoundException('Discount has expired');
    }
    if (discount.max_uses && discount.used_count >= discount.max_uses) {
      throw new NotFoundException('Discount has reached maximum uses');
    }

    return discount;
  }

  async updateDiscount(id: string, dto: UpdateDiscountDto) {
    await this.findOneDiscount(id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.valid_until !== undefined) data.valid_until = dto.valid_until ? new Date(dto.valid_until) : null;
    if (dto.max_uses !== undefined) data.max_uses = dto.max_uses;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    return this.prisma.discount.update({ where: { id }, data });
  }

  // ── Tax Rates ─────────────────────────────────────────────

  async createTaxRate(dto: CreateTaxRateDto) {
    return this.prisma.taxRate.create({
      data: {
        country: dto.country,
        state: dto.state,
        tax_name: dto.tax_name,
        rate: dto.rate,
      },
    });
  }

  async findAllTaxRates(country?: string) {
    const where: any = {};
    if (country) where.country = country;
    return this.prisma.taxRate.findMany({ where, orderBy: { country: 'asc' } });
  }

  async findOneTaxRate(id: string) {
    const rate = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException('Tax rate not found');
    return rate;
  }

  async updateTaxRate(id: string, dto: UpdateTaxRateDto) {
    await this.findOneTaxRate(id);
    const data: any = {};
    if (dto.rate !== undefined) data.rate = dto.rate;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    return this.prisma.taxRate.update({ where: { id }, data });
  }

  // ── Payment Gateway Configs ───────────────────────────────

  async createGatewayConfig(dto: CreateGatewayConfigDto) {
    const existing = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gateway_name: dto.gateway_name },
    });
    if (existing) throw new ConflictException(`Gateway "${dto.gateway_name}" already configured`);

    return this.prisma.paymentGatewayConfig.create({
      data: {
        gateway_name: dto.gateway_name,
        api_key: dto.api_key,
        secret_key: dto.secret_key,
        webhook_secret: dto.webhook_secret,
        is_test_mode: dto.is_test_mode ?? true,
      },
    });
  }

  async findAllGatewayConfigs() {
    const configs = await this.prisma.paymentGatewayConfig.findMany({
      orderBy: { gateway_name: 'asc' },
    });
    // Strip secret keys from response for security
    return configs.map((c) => ({
      id: c.id,
      gateway_name: c.gateway_name,
      is_active: c.is_active,
      is_test_mode: c.is_test_mode,
      has_api_key: !!c.api_key,
      has_secret_key: !!c.secret_key,
      has_webhook_secret: !!c.webhook_secret,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  }

  async updateGatewayConfig(id: string, dto: UpdateGatewayConfigDto) {
    const config = await this.prisma.paymentGatewayConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Gateway config not found');

    const data: any = {};
    if (dto.api_key !== undefined) data.api_key = dto.api_key;
    if (dto.secret_key !== undefined) data.secret_key = dto.secret_key;
    if (dto.webhook_secret !== undefined) data.webhook_secret = dto.webhook_secret;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.is_test_mode !== undefined) data.is_test_mode = dto.is_test_mode;

    await this.prisma.paymentGatewayConfig.update({ where: { id }, data });

    // Return without secrets
    return { id, gateway_name: config.gateway_name, ...data, api_key: undefined, secret_key: undefined };
  }
}
