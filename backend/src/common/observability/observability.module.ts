import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SccReporterService } from './scc-reporter.service';
import { ObservabilityInterceptor } from './observability.interceptor';
import { ObservabilityController } from './observability.controller';

/**
 * Wires the main app into the SCC Error Center:
 *  • ObservabilityInterceptor (APP_INTERCEPTOR) forwards server-side errors.
 *  • ObservabilityController proxies browser error reports.
 *  • SccReporterService is exported so feature code (payments, POS, etc.) can
 *    report domain-specific CRITICAL errors explicitly.
 */
@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [
    SccReporterService,
    { provide: APP_INTERCEPTOR, useClass: ObservabilityInterceptor },
  ],
  exports: [SccReporterService],
})
export class ObservabilityModule {}
