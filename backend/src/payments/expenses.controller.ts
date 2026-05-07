import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { ExpenseEventsService } from './expenses/expense-events.service';
import { ExpenseMetricsService } from './expenses/expense-metrics.service';
import { ExpenseIntelligenceService } from './expenses/expense-intelligence.service';
import { ExpenseExportService } from './expenses/expense-export.service';
import {
  CreateExpenseDto,
  ExpenseFiltersDto,
  ExportExpensesDto,
  ReverseExpenseDto,
} from './expenses/dto';

@Controller('api/v1/expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(
    private readonly events: ExpenseEventsService,
    private readonly metrics: ExpenseMetricsService,
    private readonly intelligence: ExpenseIntelligenceService,
    private readonly exports: ExpenseExportService,
  ) {}

  // ─── Create (append-only event) ────────────────────────────────
  @Post()
  @Permissions({ module: 'payments', action: 'create' })
  create(@Body() body: CreateExpenseDto, @CurrentUser() user: JwtPayload) {
    return this.events.createExpense(body, { staff_id: user?.user_id });
  }

  // ─── Flat list (legacy compatible) ─────────────────────────────
  @Get()
  @Permissions({ module: 'payments', action: 'view' })
  findAll(@Query() filters: ExpenseFiltersDto) {
    return this.events.findAll(filters);
  }

  // ─── Timeline (grouped by day) ─────────────────────────────────
  @Get('timeline')
  @Permissions({ module: 'payments', action: 'view' })
  timeline(@Query() filters: ExpenseFiltersDto) {
    return this.events.getTimeline(filters);
  }

  // ─── Today + Month + category breakdown ────────────────────────
  @Get('summary')
  @Permissions({ module: 'payments', action: 'view' })
  async summary(@Query('branch_id') branchId: string, @Query('month') yyyyMm?: string) {
    if (!branchId) {
      throw new HttpException('branch_id is required', HttpStatus.BAD_REQUEST);
    }
    const [today, month, byCategory] = await Promise.all([
      this.metrics.getTodaySummary(branchId),
      this.metrics.getMonthSummary(branchId, yyyyMm),
      this.metrics.getCategoryDistribution(branchId, yyyyMm),
    ]);
    return { today, month, by_category: byCategory };
  }

  // ─── Intelligence bundle: P&L + cashflow + recurring ───────────
  @Get('intelligence')
  @Permissions({ module: 'payments', action: 'view' })
  async getIntelligence(
    @Query('branch_id') branchId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    if (!branchId) {
      throw new HttpException('branch_id is required', HttpStatus.BAD_REQUEST);
    }
    const [pl, cashflow, recurring] = await Promise.all([
      this.intelligence.getProfitLoss(branchId, dateFrom, dateTo),
      this.intelligence.predictCashflow(branchId),
      this.intelligence.detectRecurringPatterns(branchId),
    ]);
    return { profit_loss: pl, cashflow, recurring };
  }

  // ─── CSV / XLSX export ─────────────────────────────────────────
  @Get('export')
  @Permissions({ module: 'payments', action: 'export' })
  async exportFile(@Query() query: ExportExpensesDto, @Res() res: Response) {
    const { content, filename, mime } = await this.exports.buildExport(query);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  // ─── Single expense with reversal chain ────────────────────────
  @Get(':id')
  @Permissions({ module: 'payments', action: 'view' })
  getOne(@Param('id') id: string) {
    return this.events.getExpenseById(id);
  }

  // ─── Immutable reversal ────────────────────────────────────────
  @Post(':id/reverse')
  @Permissions({ module: 'payments', action: 'edit' })
  reverse(
    @Param('id') id: string,
    @Body() body: ReverseExpenseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.events.reverseExpense(id, body, { staff_id: user?.user_id });
  }

  // ─── Legacy endpoints — now return 410 Gone ────────────────────
  // These are retained so old clients receive a helpful error instead of a silent
  // behavioural change. Anyone calling them should migrate to POST /:id/reverse.
  @Patch(':id')
  @Permissions({ module: 'payments', action: 'edit' })
  legacyUpdate(@Param('id') _id: string) {
    throw new HttpException(
      {
        statusCode: 410,
        message:
          'Expenses are now immutable. To modify an expense, use POST /api/v1/expenses/:id/reverse and create a new expense with the corrected values.',
        code: 'EXPENSE_IMMUTABLE',
      },
      HttpStatus.GONE,
    );
  }

  @Delete(':id')
  @Permissions({ module: 'payments', action: 'edit' })
  legacyDelete(@Param('id') _id: string) {
    throw new HttpException(
      {
        statusCode: 410,
        message:
          'Expenses are now immutable. Use POST /api/v1/expenses/:id/reverse instead.',
        code: 'EXPENSE_IMMUTABLE',
      },
      HttpStatus.GONE,
    );
  }
}
