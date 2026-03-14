import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosService } from './pos.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import { CreatePosSaleDto, CreateProductReturnDto } from './dto';

@Controller('api/v1/pos')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('sales')
  @Permissions({ module: 'inventory', action: 'create' })
  createSale(@Body() dto: CreatePosSaleDto) {
    return this.posService.createSale(dto);
  }

  @Get('sales')
  @Permissions({ module: 'inventory', action: 'view' })
  findAllSales(
    @Query('branch_id') branchId?: string,
    @Query('member_id') memberId?: string,
    @Query('staff_id') staffId?: string,
    @Query('payment_method') paymentMethod?: string,
    @Query('status') status?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posService.findAllSales({
      branch_id: branchId,
      member_id: memberId,
      staff_id: staffId,
      payment_method: paymentMethod,
      status,
      start_date: startDate,
      end_date: endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('sales/daily-report')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'view' })
  getDailySalesReport(
    @Query('branch_id') branchId: string,
    @Query('date') date?: string,
  ) {
    return this.posService.getDailySalesReport(branchId, date);
  }

  @Get('sales/top-products')
  @Permissions({ module: 'inventory', action: 'view' })
  getTopSellingProducts(
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posService.getTopSellingProducts({
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('sales/:id')
  @Permissions({ module: 'inventory', action: 'view' })
  findOneSale(@Param('id') id: string) {
    return this.posService.findOneSale(id);
  }

  @Post('returns')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  processReturn(@Body() dto: CreateProductReturnDto) {
    return this.posService.processReturn(dto);
  }
}
