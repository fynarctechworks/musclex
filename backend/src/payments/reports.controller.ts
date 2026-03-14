import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinancialReportsService } from './financial-reports.service';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';

@Controller('api/v1/financial-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: FinancialReportsService) {}

  @Get('daily')
  @Permissions({ module: 'payments', action: 'view' })
  getDailyRevenue(
    @Query('branch_id') branch_id: string,
    @Query('date') date?: string,
  ) {
    return this.reportsService.getDailyRevenue(branch_id, date ?? new Date().toISOString().slice(0, 10));
  }

  @Get('monthly')
  @Permissions({ module: 'payments', action: 'view' })
  getMonthlyRevenue(
    @Query('branch_id') branch_id: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.reportsService.getMonthlyRevenue(
      branch_id,
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : now.getMonth() + 1,
    );
  }

  @Get('dashboard')
  @Permissions({ module: 'payments', action: 'view' })
  getDashboardMetrics(@Query('branch_id') branch_id: string) {
    return this.reportsService.getDashboardMetrics(branch_id);
  }

  @Get('membership-revenue')
  @Permissions({ module: 'payments', action: 'view' })
  getMembershipRevenue(
    @Query('branch_id') branch_id: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
  ) {
    return this.reportsService.getMembershipRevenue(branch_id, date_from, date_to);
  }

  @Get('ledger')
  @Permissions({ module: 'payments', action: 'view' })
  getFinancialLedger(
    @Query('branch_id') branch_id?: string,
    @Query('reference_type') reference_type?: string,
    @Query('transaction_type') transaction_type?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getFinancialLedger({
      branch_id,
      reference_type,
      transaction_type,
      date_from,
      date_to,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }
}
