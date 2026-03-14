import { Module } from '@nestjs/common';
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

@Module({
  imports: [PrismaModule],
  controllers: [
    PaymentsController,
    ExpensesController,
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
  ],
  exports: [
    PaymentsService,
    BillingService,
    RefundsService,
    DiscountsService,
    FinancialReportsService,
  ],
})
export class PaymentsModule {}
