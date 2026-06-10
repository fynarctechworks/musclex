import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { ProcessRefundDto } from './dto';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { StaffIdempotencyInterceptor } from '../common/idempotency/staff-idempotency.interceptor';

@Controller('api/v1/refunds')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(StaffIdempotencyInterceptor)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @Idempotent()
  @Permissions({ module: 'payments', action: 'create' })
  processRefund(@Body() dto: ProcessRefundDto) {
    return this.refundsService.processRefund(dto);
  }

  @Get()
  @Permissions({ module: 'payments', action: 'view' })
  findAll(
    @Query('payment_id') payment_id?: string,
    @Query('member_id') member_id?: string,
    @Query('status') status?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.refundsService.findAllRefunds({
      payment_id,
      member_id,
      status,
      date_from,
      date_to,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get(':id')
  @Permissions({ module: 'payments', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.refundsService.findOne(id);
  }
}
