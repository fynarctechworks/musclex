import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SystemErrorsController } from './controllers/system-errors.controller';
import { SystemAlertsController } from './controllers/system-alerts.controller';
import { ErrorIngestService } from './services/error-ingest.service';
import { ErrorQueryService } from './services/error-query.service';
import { ErrorGroupingService } from './services/error-grouping.service';
import { PiiScrubService } from './services/pii-scrub.service';
import { AlertService } from './services/alert.service';
import { ErrorRetentionService } from './services/error-retention.service';
import {
  ALERT_EMAIL_TRANSPORT,
  LoggingAlertEmailTransport,
  ResendAlertEmailTransport,
} from './services/alert-email.transport';
import { EmailService } from '../email/email.service';
import { MonitoringGateway } from './gateways/monitoring.gateway';
import { IngestKeyGuard } from './guards/ingest-key.guard';

/**
 * System Monitoring & Observability Center.
 * Phase 1: centralized error ingestion, grouping, query, and resolution workflow.
 * Phase 2: realtime gateway (/monitoring) + alert delivery (dashboard + email).
 * See docs/ERROR_CENTER_ARCHITECTURE.md.
 *
 * AuthModule is imported to provide JwtService for the gateway handshake.
 */
@Module({
  imports: [AuthModule],
  controllers: [SystemErrorsController, SystemAlertsController],
  providers: [
    ErrorIngestService,
    ErrorQueryService,
    ErrorGroupingService,
    PiiScrubService,
    AlertService,
    ErrorRetentionService,
    MonitoringGateway,
    IngestKeyGuard,
    // Use the real Resend transport when an API key is configured; otherwise
    // fall back to logging (dev/CI) so the app still boots without email.
    {
      provide: ALERT_EMAIL_TRANSPORT,
      inject: [EmailService],
      useFactory: (email: EmailService) =>
        email.enabled ? new ResendAlertEmailTransport(email) : new LoggingAlertEmailTransport(),
    },
  ],
  exports: [ErrorIngestService, ErrorGroupingService, PiiScrubService],
})
export class SystemMonitoringModule {}
