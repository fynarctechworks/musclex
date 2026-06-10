import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { IdempotencyKey } from '../../common/decorators/idempotency-key.decorator';
import { RecordPaymentDto, PaymentFilterDto } from './dto/billing.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('payments')
  @ApiOperation({ summary: 'List all payments' })
  findAll(@Query() query: PaymentFilterDto) {
    return this.billingService.findAll(query);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Full billing detail for one tenant (invoices, payments, profile, issues)' })
  getTenantDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.getTenantBillingDetail(id);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record manual payment' })
  recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.billingService.recordPayment(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('payments/:id/retry')
  @ApiOperation({ summary: 'Retry failed payment' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-generated key (16-128 chars). Reuse across network retries to guarantee at-most-once execution.',
  })
  retry(
    @Param('id', ParseUUIDPipe) id: string,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.billingService.retryPayment(id, idempotencyKey, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('payments/:id/mark-paid')
  @ApiOperation({ summary: 'Manually mark payment as paid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-generated key (16-128 chars). Reuse across network retries to guarantee at-most-once execution.',
  })
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.billingService.markAsPaid(id, idempotencyKey, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('payments/:id/refund')
  @ApiOperation({ summary: 'Refund payment' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-generated key (16-128 chars). Reuse across network retries to guarantee at-most-once execution.',
  })
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @IdempotencyKey() idempotencyKey: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.billingService.refund(id, idempotencyKey, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }
}
