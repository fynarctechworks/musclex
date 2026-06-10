import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronLockService } from '../common/services/cron-lock.service';
import { ReferralWalletService } from './referral-wallet.service';

/**
 * Scheduled expiry of stale referral wallet credits.
 *
 * Runs daily. For every credit entry whose expires_at has passed and that
 * has not already been countered, writes a negative 'expiry' entry so the
 * cached balance reflects only spendable credit.
 *
 * Idempotent: the wallet service skips credits that already have an expiry
 * counter, so re-running (or overlapping runs prevented by the lock) is safe.
 */
@Injectable()
export class ReferralWalletJob {
  private readonly logger = new Logger(ReferralWalletJob.name);

  constructor(
    private readonly wallet: ReferralWalletService,
    private readonly cronLock: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expireCredits() {
    await this.cronLock.withLock('cron:referral_wallet_expiry', async () => {
      this.logger.log('Expiring stale referral wallet credits...');
      try {
        const expired = await this.wallet.expireStaleCredits();
        if (expired > 0) {
          this.logger.log(`Expired ${expired} referral wallet credit(s)`);
        }
      } catch (error) {
        this.logger.error('Failed to expire referral wallet credits', error as Error);
      }
    });
  }
}
