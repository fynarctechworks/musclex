import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsArray, ArrayMaxSize } from 'class-validator';
import { SccReporterService, SccErrorEvent } from './scc-reporter.service';

class ReportErrorsDto {
  @IsArray()
  @ArrayMaxSize(50)
  // Elements are intentionally not class-validated here — the SCC ingest
  // endpoint is the strict validator (enum checks) and the authoritative
  // PII scrubber. This proxy just relays from the browser with the
  // server-held ingest key so the key never ships to the client.
  events!: SccErrorEvent[];
}

/**
 * Thin browser → SCC proxy for frontend error reporting. Public + throttled.
 * Keeps the SCC ingest key server-side. No auth guard (errors can happen before
 * login); the global SubscriptionLockGuard is a no-op here (no request.user).
 */
@Controller('observability')
export class ObservabilityController {
  constructor(private readonly reporter: SccReporterService) {}

  @Post('report')
  @HttpCode(202)
  report(@Body() body: ReportErrorsDto) {
    const events = (body.events ?? [])
      .slice(0, 50)
      .map((e) => ({ ...e, source: e.source || 'FRONTEND' }));
    void this.reporter.reportMany(events);
    return { accepted: events.length };
  }
}
