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
import { PayrollService } from './payroll.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import { UpsertPayrollConfigDto, ProcessPayrollDto, UpdatePayrollRecordDto } from './dto';

@Controller('api/v1/payroll')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ── Payroll Config ────────────────────────────────────────────

  @Get('config/:staffId')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'staff', action: 'view' })
  getConfig(@Param('staffId') staffId: string) {
    return this.payrollService.getConfig(staffId);
  }

  @Post('config')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'edit' })
  upsertConfig(@Body() dto: UpsertPayrollConfigDto) {
    return this.payrollService.upsertConfig(dto);
  }

  // ── Payroll Summary ───────────────────────────────────────────

  @Get('summary')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'staff', action: 'view' })
  getPayrollSummary(
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
  ) {
    return this.payrollService.getPayrollSummary({ branch_id, organization_id });
  }

  // ── Payroll Records (Pay Runs) ────────────────────────────────

  @Post('process')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'create' })
  processPayroll(@Body() dto: ProcessPayrollDto) {
    return this.payrollService.processPayroll(dto);
  }

  @Get('records')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'staff', action: 'view' })
  getPayrollRecords(
    @Query('staff_id') staff_id?: string,
    @Query('status') status?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService.getPayrollRecords({
      staff_id,
      status,
      start_date,
      end_date,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Patch('records/:id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'staff', action: 'edit' })
  updatePayrollRecord(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollRecordDto,
  ) {
    return this.payrollService.updatePayrollRecord(id, dto);
  }

  // ── Trainer Revenue ───────────────────────────────────────────

  @Get('revenue')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'staff', action: 'view' })
  getRevenueReport(
    @Query('trainer_id') trainer_id?: string,
    @Query('branch_id') branch_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.payrollService.getRevenueReport({
      trainer_id,
      branch_id,
      start_date,
      end_date,
    });
  }
}
