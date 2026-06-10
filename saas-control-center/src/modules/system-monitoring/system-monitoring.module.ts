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
} from './services/alert-email.transport';
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
    { provide: ALERT_EMAIL_TRANSPORT, useClass: LoggingAlertEmailTransport },
  ],
  exports: [ErrorIngestService, ErrorGroupingService, PiiScrubService],
})
export class SystemMonitoringModule {}
