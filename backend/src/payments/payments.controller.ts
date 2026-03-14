import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';
import { RecordCashDto } from './dto/record-cash.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('api/v1/payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('cash')
  @Permissions({ module: 'payments', action: 'create' })
  recordCash(
    @Body() body: RecordCashDto,
  ) {
    return this.paymentsService.recordCash(body);
  }

  @Post('create-order')
  @Permissions({ module: 'payments', action: 'create' })
  createOrder(
    @Body() body: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(body);
  }

  @Post('verify')
  @Permissions({ module: 'payments', action: 'create' })
  verifyPayment(
    @Body() body: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(body);
  }

  @Get()
  @Permissions({ module: 'payments', action: 'view' })
  findAll(
    @Query('branch_id') branch_id?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findAll({
      branch_id,
      date_from,
      date_to,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get(':id/invoice')
  @Permissions({ module: 'payments', action: 'view' })
  getInvoice(@Param('id') id: string) {
    return this.paymentsService.getInvoice(id);
  }
}
