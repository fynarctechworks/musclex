import { Injectable, Logger } from '@nestjs/common';

/**
 * Shape of an error event forwarded to the SaaS Control Center's ingest
 * endpoint (`POST /system-errors`). Mirrors the SCC IngestErrorEventDto.
 */
export interface SccErrorEvent {
  message: string;
  source: string; // SCC ErrorSource enum value (BACKEND | DATABASE | API | ...)
  module?: string;
  severity?: string; // CRITICAL | HIGH | MEDIUM | LOW | INFO
  environment?: string;
  stack_trace?: string;
  tenant_id?: string;
  user_id?: string;
  page?: string;
  api_endpoint?: string;
  http_status?: number;
  request_payload?: unknown;
  response_payload?: unknown;
  breadcrumbs?: unknown;
  device_info?: unknown;
  browser_info?: unknown;
  app_version?: string;
  screenshot_url?: string;
}

/**
 * Server-to-server forwarder to the SCC Error Center.
 *
 * Errors flow through the SCC's ingest pipeline (fingerprint grouping, alerts,
 * realtime) rather than being written straight to the shared `scc` schema, so
 * grouping + alerting stays in one place. This is HTTP, authenticated with the
 * server-held `x-ingest-key` (never shipped to the browser).
 *
 * Fully non-fatal: every method swallows its own errors. A monitoring outage
 * must never affect a real gym request. No-ops when SCC_INGEST_URL /
 * SCC_INGEST_KEY are unset (e.g. local dev without the SCC running).
 */
@Injectable()
export class SccReporterService {
  private readonly logger = new Logger(SccReporterService.name);

  private readonly url =
    process.env.SCC_INGEST_URL ||
    (process.env.SCC_BASE_URL
      ? `${process.env.SCC_BASE_URL.replace(/\/$/, '')}/system-errors`
      : '');
  private readonly key = process.env.SCC_INGEST_KEY || '';
  private readonly environment =
    process.env.NODE_ENV === 'production'
      ? 'PRODUCTION'
      : process.env.NODE_ENV === 'staging'
        ? 'STAGING'
        : 'DEVELOPMENT';
  private readonly appVersion =
    process.env.APP_VERSION || process.env.GIT_SHA || undefined;

  get enabled(): boolean {
    return Boolean(this.url && this.key);
  }

  /** Fire-and-forget single event. */
  report(event: SccErrorEvent): void {
    void this.reportMany([event]);
  }

  async reportMany(events: SccErrorEvent[]): Promise<void> {
    if (!this.enabled || events.length === 0) return;

    const body = JSON.stringify({
      events: events.map((e) => ({
        environment: this.environment,
        app_version: this.appVersion,
        ...e,
      })),
    });

    try {
      await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ingest-key': this.key },
        body,
        // Don't let a slow/hung SCC hold a request thread.
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      this.logger.warn(`SCC error report failed: ${(err as Error).message}`);
    }
  }
}
