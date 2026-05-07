import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { DiscountService } from './discount.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discount.dto';

@ApiTags('Discounts')
@ApiBearerAuth()
@Controller('discounts')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Get()
  @ApiOperation({ summary: 'List all discounts' })
  findAll(@Query('include_expired') includeExpired?: boolean) {
    return this.discountService.findAll(includeExpired);
  }

  @Get('price/:planId')
  @ApiOperation({ summary: 'Get effective price for a plan after discount' })
  getEffectivePrice(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Query('cycle') cycle: 'monthly' | 'yearly' = 'monthly',
  ) {
    return this.discountService.getEffectivePrice(planId, cycle);
  }

  @Post()
  @ApiOperation({ summary: 'Create discount' })
  create(
    @Body() dto: CreateDiscountDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.discountService.create(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update discount' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.discountService.update(id, dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }
}
