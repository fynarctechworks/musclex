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
import { BillingService } from './billing.service';
import { CreateInvoiceDto, UpdateInvoiceStatusDto } from './dto';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';

@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @Permissions({ module: 'payments', action: 'create' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get()
  @Permissions({ module: 'payments', action: 'view' })
  findAll(
    @Query('branch_id') branch_id?: string,
    @Query('member_id') member_id?: string,
    @Query('status') status?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAllInvoices({
      branch_id,
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
    return this.billingService.findOneInvoice(id);
  }

  @Patch(':id/status')
  @Permissions({ module: 'payments', action: 'edit' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateInvoiceStatusDto) {
    return this.billingService.updateInvoiceStatus(id, dto.status);
  }

  @Post(':id/cancel')
  @Permissions({ module: 'payments', action: 'edit' })
  cancel(@Param('id') id: string) {
    return this.billingService.cancelInvoice(id);
  }
}
