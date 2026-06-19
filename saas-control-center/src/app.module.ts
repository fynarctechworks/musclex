import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './config/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { BillingModule } from './modules/billing/billing.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { HealthModule } from './modules/health/health.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { SystemMonitoringModule } from './modules/system-monitoring/system-monitoring.module';
import { MemberAppAnalyticsModule } from './modules/member-app-analytics/member-app-analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    EmailModule,
    AuthModule,
    TenantModule,
    PlansModule,
    SubscriptionModule,
    BillingModule,
    FeatureFlagsModule,
    DashboardModule,
    AnalyticsModule,
    AuditLogsModule,
    HealthModule,
    ReferralsModule,
    SystemMonitoringModule,
    MemberAppAnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
