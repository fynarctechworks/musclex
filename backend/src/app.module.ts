import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ActiveBranchInterceptor } from './common/interceptors/active-branch.interceptor';
import { StripSecretsInterceptor } from './common/interceptors/strip-secrets.interceptor';
import { AppController } from './app.controller';
import { TenantMiddleware } from './common';
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
import { ReferralsModule } from './referrals/referrals.module';
import { OnboardingPlansModule } from './onboarding/onboarding-plans.module';
import { InvoicesModule } from './invoices/invoices.module';
import { UploadsModule } from './uploads/uploads.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage';
import { EnhancedThrottlerGuard } from './common/throttler/enhanced-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', 'info'),
          transport: config.get('NODE_ENV') !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          autoLogging: { ignore: (req: any) => req.url === '/health' },
        },
      }),
    }),
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
    ReferralsModule,
    OnboardingPlansModule,
    InvoicesModule,
    UploadsModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: ActiveBranchInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StripSecretsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant schema routing to all authenticated routes (non-auth endpoints)
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/v1/auth/(.*)', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
