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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
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
  retry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.billingService.retryPayment(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('payments/:id/mark-paid')
  @ApiOperation({ summary: 'Manually mark payment as paid' })
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.billingService.markAsPaid(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('payments/:id/refund')
  @ApiOperation({ summary: 'Refund payment' })
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.billingService.refund(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }
}
