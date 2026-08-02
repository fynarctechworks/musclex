/**
 * Backfill DailyGymMetrics / RevenueAnalytics / MembershipAnalytics after the
 * M0 Fix-2 correction (Payment status 'completed'→'paid', PT revenue source,
 * nullable-org upserts). Historical rows were permanently zero before the fix.
 *
 * Idempotent: re-running a day overwrites that day's rows.
 *
 * CAVEAT: point-in-time fields (active_members, total_active, churn base)
 * reflect CURRENT state, not the historical date — only period-scoped numbers
 * (revenue, visits, signups, cancellations) are historically accurate. Rows
 * older than the fix should be read with that in mind.
 *
 * Usage (from backend/):
 *   npm run build
 *   npx ts-node scripts/backfill-analytics.ts --from 2026-05-01 --to 2026-08-02
 *   npx ts-node scripts/backfill-analytics.ts            # defaults: last 90 days
 */
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';

function parseArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseDay(s: string): Date {
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${s} (expected YYYY-MM-DD)`);
  return d;
}

async function main() {
  const to = parseArg('to') ? parseDay(parseArg('to')!) : new Date();
  to.setHours(0, 0, 0, 0);
  const from = parseArg('from')
    ? parseDay(parseArg('from')!)
    : (() => { const d = new Date(to); d.setDate(d.getDate() - 90); return d; })();

  if (from > to) throw new Error('--from must be <= --to');

  const { AppModule } = require('../dist/app.module');
  const { MetricsAggregationJob } = require('../dist/analytics/jobs/metrics-aggregation.job');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const job = app.get(MetricsAggregationJob);
    const totalDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    console.log(`Backfilling ${totalDays} days: ${from.toDateString()} → ${to.toDateString()}`);

    let dayNum = 0;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      dayNum++;
      const summary = await job.backfillDay(new Date(d));
      console.log(
        `  [${dayNum}/${totalDays}] ${d.toISOString().slice(0, 10)} — ` +
          `${summary.ok}/${summary.total} gyms ok${summary.failed ? `, ${summary.failed} FAILED` : ''}`,
      );
    }
    console.log('Backfill complete.');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('backfill-analytics failed:', e);
  process.exit(1);
});
