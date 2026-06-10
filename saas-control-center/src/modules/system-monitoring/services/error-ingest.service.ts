import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ErrorSeverity,
  ErrorStatus,
  AppEnvironment,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ErrorGroupingService } from './error-grouping.service';
import { PiiScrubService } from './pii-scrub.service';
import { AlertService } from './alert.service';
import { MonitoringGateway } from '../gateways/monitoring.gateway';
import { IngestErrorEventDto } from '../dto/ingest-error.dto';
import { IngestResult, IngestedGroup, SEVERITY_RANK } from '../types/monitoring.types';

@Injectable()
export class ErrorIngestService {
  private readonly logger = new Logger(ErrorIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly grouping: ErrorGroupingService,
    private readonly scrub: PiiScrubService,
    private readonly alerts: AlertService,
    private readonly gateway: MonitoringGateway,
  ) {}

  async ingestBatch(
    events: IngestErrorEventDto[],
    ctx: { ipAddress?: string } = {},
  ): Promise<IngestResult> {
    const groups: IngestedGroup[] = [];
    let stored = 0;

    for (const event of events) {
      try {
        groups.push(await this.ingestOne(event, ctx.ipAddress));
        stored++;
      } catch (err) {
        // One bad event must never fail the whole batch or surface secrets.
        this.logger.error(
          `Failed to ingest event (source=${event.source}): ${(err as Error).message}`,
        );
      }
    }

    return { received: events.length, stored, groups };
  }

  private async ingestOne(
    event: IngestErrorEventDto,
    ipAddress?: string,
  ): Promise<IngestedGroup> {
    const fingerprint = this.grouping.fingerprint({
      message: event.message,
      source: event.source,
      module: event.module,
      stack_trace: event.stack_trace,
    });
    const severity = event.severity ?? ErrorSeverity.MEDIUM;
    const environment = event.environment ?? AppEnvironment.PRODUCTION;

    const existing = await this.prisma.systemError.findUnique({
      where: { fingerprint },
      select: { id: true, severity: true, status: true },
    });

    const occurrenceData = this.buildOccurrenceData(event, environment, ipAddress);

    if (!existing) {
      const created = await this.prisma.systemError.create({
        data: {
          fingerprint,
          title: this.grouping.title(event.message),
          message: event.message.slice(0, 2000),
          source: event.source,
          module: event.module,
          severity,
          status: ErrorStatus.OPEN,
          environment,
          occurrence_count: 1,
          affected_tenants: event.tenant_id ? 1 : 0,
          affected_users: event.user_id ? 1 : 0,
          occurrences: { create: occurrenceData },
        },
        select: { id: true },
      });

      this.gateway.emitErrorNew({
        error_id: created.id,
        fingerprint,
        title: this.grouping.title(event.message),
        source: event.source,
        severity,
        environment,
        tenant_id: event.tenant_id,
      });
      await this.maybeAlert(created.id, severity, event, true);
      return { fingerprint, error_id: created.id, is_new: true, reopened: false };
    }

    // Existing group: add the occurrence, then recompute rollups.
    await this.prisma.errorOccurrence.create({
      data: { error_id: existing.id, ...occurrenceData },
    });

    const reopened =
      existing.status === ErrorStatus.RESOLVED ||
      existing.status === ErrorStatus.IGNORED;
    const escalate = SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity];

    const [tenantCount, userCount] = await Promise.all([
      this.distinctCount(existing.id, 'tenant_id'),
      this.distinctCount(existing.id, 'user_id'),
    ]);

    await this.prisma.systemError.update({
      where: { id: existing.id },
      data: {
        occurrence_count: { increment: 1 },
        last_seen_at: new Date(),
        affected_tenants: tenantCount,
        affected_users: userCount,
        ...(escalate ? { severity } : {}),
        ...(reopened ? { status: ErrorStatus.REOPENED } : {}),
      },
    });

    if (reopened) {
      await this.prisma.errorActivityLog.create({
        data: {
          error_id: existing.id,
          action: 'REOPEN',
          from_value: existing.status,
          to_value: ErrorStatus.REOPENED,
          note: 'Auto-reopened: recurred after resolution.',
        },
      });
    }

    const effectiveSeverity = escalate ? severity : existing.severity;
    this.gateway.emitErrorUpdated({
      error_id: existing.id,
      fingerprint,
      severity: effectiveSeverity,
      reopened,
      occurrence_delta: 1,
    });
    await this.maybeAlert(existing.id, effectiveSeverity, event, false);

    return { fingerprint, error_id: existing.id, is_new: false, reopened };
  }

  /** Build the scrubbed ErrorOccurrence create payload (json fields omitted when empty). */
  private buildOccurrenceData(
    event: IngestErrorEventDto,
    environment: AppEnvironment,
    ipAddress?: string,
  ): Prisma.ErrorOccurrenceCreateWithoutErrorInput {
    const data: Prisma.ErrorOccurrenceCreateWithoutErrorInput = {
      tenant_id: event.tenant_id,
      user_id: event.user_id,
      stack_trace: event.stack_trace,
      page: event.page,
      api_endpoint: event.api_endpoint,
      http_status: event.http_status,
      ip_address: ipAddress,
      app_version: event.app_version,
      screenshot_url: event.screenshot_url,
      environment,
    };

    const request = this.scrub.scrub(event.request_payload);
    const response = this.scrub.scrub(event.response_payload);
    const breadcrumbs = this.scrub.scrub(event.breadcrumbs);
    const device = this.scrub.scrub(event.device_info);
    const browser = this.scrub.scrub(event.browser_info);

    if (request !== undefined) data.request_payload = request as Prisma.InputJsonValue;
    if (response !== undefined) data.response_payload = response as Prisma.InputJsonValue;
    if (breadcrumbs !== undefined) data.breadcrumbs = breadcrumbs as Prisma.InputJsonValue;
    if (device !== undefined) data.device_info = device as Prisma.InputJsonValue;
    if (browser !== undefined) data.browser_info = browser as Prisma.InputJsonValue;

    return data;
  }

  private async distinctCount(
    errorId: string,
    field: 'tenant_id' | 'user_id',
  ): Promise<number> {
    const rows = await this.prisma.errorOccurrence.findMany({
      where: { error_id: errorId, NOT: { [field]: null } },
      distinct: [field],
      select: { [field]: true },
    });
    return rows.length;
  }

  /**
   * Fan a CRITICAL error out through the alert pipeline (dashboard realtime +
   * email). Only alerts on a brand-new group to avoid alert spam on recurrences
   * of an already-known critical issue.
   */
  private async maybeAlert(
    errorId: string,
    severity: ErrorSeverity,
    event: IngestErrorEventDto,
    isNew: boolean,
  ): Promise<void> {
    if (severity !== ErrorSeverity.CRITICAL || !isNew) return;

    const where = event.tenant_id ? ` (gym: ${event.tenant_id})` : '';
    try {
      await this.alerts.dispatchCritical({
        error_id: errorId,
        severity,
        title: `Critical: ${this.grouping.title(event.message)}`.slice(0, 200),
        body: `${event.source}${event.module ? `/${event.module}` : ''}${where}`,
      });
    } catch (err) {
      // An alerting failure must never drop the ingested error.
      this.logger.error(`Alert dispatch failed: ${(err as Error).message}`);
    }
  }
}
