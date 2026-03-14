import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { PaymentsModule } from './payments/payments.module';
import { ClassesModule } from './classes/classes.module';
import { StaffModule } from './staff/staff.module';
import { MarketingModule } from './marketing/marketing.module';
import { AiModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BranchesModule } from './branches/branches.module';
import { RolesModule } from './roles/roles.module';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { OrganizationModule } from './organization/organization.module';
import { InventoryModule } from './inventory/inventory.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PlatformModule } from './platform/platform.module';
import { QueueModule } from './queue/queue.module';
import { SearchModule } from './search/search.module';
import { ComplianceModule } from './compliance/compliance.module';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage';
import { EnhancedThrottlerGuard } from './common/throttler/enhanced-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'burst',
        ttl: 10000,
        limit: 50,
      },
    ]),
    PrismaModule,
    AuthModule,
    BranchesModule,
    MembersModule,
    CheckInsModule,
    PaymentsModule,
    ClassesModule,
    StaffModule,
    MarketingModule,
    AiModule,
    DashboardModule,
    RolesModule,
    AuditModule,
    SettingsModule,
    OrganizationModule,
    InventoryModule,
    AnalyticsModule,
    PlatformModule,
    QueueModule.register(),
    SearchModule,
    ComplianceModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: ThrottlerStorage,
      useClass: RedisThrottlerStorage,
    },
    {
      provide: APP_GUARD,
      useClass: EnhancedThrottlerGuard,
    },
  ],
})
export class AppModule {}
