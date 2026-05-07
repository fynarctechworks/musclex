import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { InvoicesController } from './invoices.controller';
import { BillingService } from './billing.service';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { ReportsController } from './reports.controller';
import { FinancialReportsService } from './financial-reports.service';

// Expense event system
import { ExpenseEventsService } from './expenses/expense-events.service';
import { ExpenseCategoriesService } from './expenses/expense-categories.service';
import { ExpenseCategoriesController } from './expenses/expense-categories.controller';
import { ExpenseMetricsService } from './expenses/expense-metrics.service';
import { ExpenseMetricsListener } from './expenses/expense-metrics.listener';
import { ExpenseIntelligenceService } from './expenses/expense-intelligence.service';
import { ExpenseExportService } from './expenses/expense-export.service';
import { BranchDefaultsListener } from './expenses/branch-defaults.listener';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [
    PaymentsController,
    ExpensesController,
    ExpenseCategoriesController,
    InvoicesController,
    RefundsController,
    DiscountsController,
    ReportsController,
  ],
  providers: [
    PaymentsService,
    ExpensesService,
    BillingService,
    RefundsService,
    DiscountsService,
    FinancialReportsService,
    // Expense event system
    ExpenseEventsService,
    ExpenseCategoriesService,
    ExpenseMetricsService,
    ExpenseMetricsListener,
    ExpenseIntelligenceService,
    ExpenseExportService,
    BranchDefaultsListener,
  ],
  exports: [
    PaymentsService,
    BillingService,
    RefundsService,
    DiscountsService,
    FinancialReportsService,
    ExpenseEventsService,
    ExpenseCategoriesService,
    ExpenseMetricsService,
    ExpenseIntelligenceService,
  ],
})
export class PaymentsModule {}
