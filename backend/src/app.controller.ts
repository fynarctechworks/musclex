import { Controller, Get, NotFoundException } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // TEMP — Sentry verification endpoint. Returns 404 unless ENABLE_SENTRY_DEBUG=true.
  // REMOVE after launch verification (see 16-monitoring-setup-prompt.txt Step 3).
  @Get('debug/sentry-test')
  sentryTest() {
    if (process.env.ENABLE_SENTRY_DEBUG !== 'true') {
      throw new NotFoundException();
    }
    throw new Error('Sentry backend test error — safe to ignore');
  }
}
