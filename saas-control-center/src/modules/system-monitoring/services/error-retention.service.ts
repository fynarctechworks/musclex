import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type Redis from 'ioredis';
import { PrismaService } from '../../../database/prisma.service';
import { REDIS_CLIENT } from '../../../config/redis.module';
import { withCronLock } from '../../../common/utils/cron-lock';

const DEFAULT_RETENTION_DAYS = 90;
const LOCK_TTL_SEC = 300;

/**
 * Bounds the high-volume `error_occurrences` table by pruning detailed
 * occurrence rows older than the retention window. The `system_errors` group
 * (and its lifetime `occurrence_count`, which is a "times seen" counter, not a
 * live row count) is intentionally kept — so history/resolution audit survives
 * while raw event storage stays bounded.
 *
 * Runs under a Redis cron-lock so only one instance prunes per window.
 * Configure the window with ERROR_OCCURRENCE_RETENTION_DAYS (default 90).
 */
@Injectable()
export class ErrorRetentionService {
  private readonly logger = new Logger(ErrorRetentionService.name);
  private readonly retentionDays = Number(
    process.env.ERROR_OCCURRENCE_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS,
  );

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneOldOccurrences(): Promise<void> {
    await withCronLock(this.redis, 'monitoring:pruneOccurrences', LOCK_TTL_SEC, () =>
      this.run(),
    );
  }

  /** Inner body — exposed for tests; production path is the cron above. */
  async run(): Promise<void> {
    const days =
      Number.isFinite(this.retentionDays) && this.retentionDays > 0
        ? this.retentionDays
        : DEFAULT_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.errorOccurrence.deleteMany({
      where: { occurred_at: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(
        `Pruned ${count} error occurrences older than ${days} days`,
      );
    }
  }
}
