import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from '../services/reports.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
} from '../../common';
import { ReportExportDto } from '../dto';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('export')
  @Permissions({ module: 'reports', action: 'export' })
  async exportReport(@Query() dto: ReportExportDto, @Res() res: Response) {
    const result = await this.reportsService.generateReport(dto);

    if (result.format === 'csv' && 'content' in result) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.content);
    }

    // PDF data returned as JSON for frontend PDF rendering
    return res.json(result);
  }

  @Get('revenue')
  @Permissions({ module: 'reports', action: 'view' })
  async getRevenueReport(
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.generateReport({
      report_type: 'revenue',
      format: 'pdf',
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get('membership')
  @Permissions({ module: 'reports', action: 'view' })
  async getMembershipReport(
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.generateReport({
      report_type: 'membership',
      format: 'pdf',
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get('attendance')
  @Permissions({ module: 'reports', action: 'view' })
  async getAttendanceReport(
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.generateReport({
      report_type: 'attendance',
      format: 'pdf',
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get('trainers')
  @Permissions({ module: 'reports', action: 'view' })
  async getTrainerReport(
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.generateReport({
      report_type: 'trainer',
      format: 'pdf',
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get('inventory')
  @Permissions({ module: 'reports', action: 'view' })
  async getInventoryReport(
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.generateReport({
      report_type: 'inventory',
      format: 'pdf',
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }
}
