import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsService } from './services/analytics.service';
import { ReportsService } from './services/reports.service';
import { MetricsAggregationJob } from './jobs/metrics-aggregation.job';
import { DashboardAnalyticsController } from './controllers/dashboard-analytics.controller';
import { ReportsController } from './controllers/reports.controller';
import { CronLockService } from '../common/services/cron-lock.service';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardAnalyticsController, ReportsController],
  providers: [AnalyticsService, ReportsService, MetricsAggregationJob, CronLockService],
  exports: [AnalyticsService, ReportsService],
})
export class AnalyticsModule {}
