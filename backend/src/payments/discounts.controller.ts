import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import {
  CreateDiscountDto,
  UpdateDiscountDto,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  CreateGatewayConfigDto,
  UpdateGatewayConfigDto,
} from './dto';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // ─── Discounts ─────────────────────────────────────────────

  @Post('discounts')
  @Permissions({ module: 'payments', action: 'create' })
  createDiscount(@Body() dto: CreateDiscountDto) {
    return this.discountsService.createDiscount(dto);
  }

  @Get('discounts')
  @Permissions({ module: 'payments', action: 'view' })
  findAllDiscounts(
    @Query('is_active') is_active?: string,
    @Query('applicable_to') applicable_to?: string,
  ) {
    return this.discountsService.findAllDiscounts({
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      applicable_to,
    });
  }

  @Get('discounts/validate/:code')
  @Permissions({ module: 'payments', action: 'view' })
  validateDiscountCode(@Param('code') code: string) {
    return this.discountsService.validateDiscountCode(code);
  }

  @Get('discounts/:id')
  @Permissions({ module: 'payments', action: 'view' })
  findOneDiscount(@Param('id') id: string) {
    return this.discountsService.findOneDiscount(id);
  }

  @Patch('discounts/:id')
  @Permissions({ module: 'payments', action: 'edit' })
  updateDiscount(@Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.discountsService.updateDiscount(id, dto);
  }

  // ─── Tax Rates ─────────────────────────────────────────────

  @Post('tax-rates')
  @Permissions({ module: 'payments', action: 'create' })
  createTaxRate(@Body() dto: CreateTaxRateDto) {
    return this.discountsService.createTaxRate(dto);
  }

  @Get('tax-rates')
  @Permissions({ module: 'payments', action: 'view' })
  findAllTaxRates(@Query('country') country?: string) {
    return this.discountsService.findAllTaxRates(country);
  }

  @Patch('tax-rates/:id')
  @Permissions({ module: 'payments', action: 'edit' })
  updateTaxRate(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.discountsService.updateTaxRate(id, dto);
  }

  // ─── Payment Gateway Configs ───────────────────────────────

  @Post('payment-gateways')
  @Permissions({ module: 'payments', action: 'create' })
  createGatewayConfig(@Body() dto: CreateGatewayConfigDto) {
    return this.discountsService.createGatewayConfig(dto);
  }

  @Get('payment-gateways')
  @Permissions({ module: 'payments', action: 'view' })
  findAllGatewayConfigs() {
    return this.discountsService.findAllGatewayConfigs();
  }

  @Patch('payment-gateways/:id')
  @Permissions({ module: 'payments', action: 'edit' })
  updateGatewayConfig(@Param('id') id: string, @Body() dto: UpdateGatewayConfigDto) {
    return this.discountsService.updateGatewayConfig(id, dto);
  }
}
