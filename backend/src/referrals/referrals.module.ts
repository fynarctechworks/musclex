import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralsService } from './referrals.service';
import { RuleEngineService } from './rule-engine.service';
import { RewardProcessorService } from './reward-processor.service';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import { ReferralFraudService } from './referral-fraud.service';
import { ReferralWalletService } from './referral-wallet.service';
import { ReferralAdminService } from './referral-admin.service';
import { MemberReferralsService } from './member-referrals.service';
import { MemberReferralAdminService } from './member-referral-admin.service';
import { ReferralNotificationService } from './referral-notification.service';
import { ReferralAnalyticsService } from './referral-analytics.service';
import { WalletRedemptionService } from './wallet-redemption.service';
import { ReferralEventsListener } from './referral-events.listener';
import { ReferralsController } from './referrals.controller';
import { ReferralsAdminController } from './referrals-admin.controller';
import { MemberReferralsController } from './member-referrals.controller';
import { MemberReferralsAdminController } from './member-referrals-admin.controller';
import {
  B2BAnalyticsController,
  B2CAnalyticsController,
  MemberDashboardController,
} from './referral-analytics.controller';
import { ReferralsInternalController } from './referrals-internal.controller';
import { ReferralWalletJob } from './referral-wallet.job';
import { CronLockService } from '../common/services/cron-lock.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ReferralsController,
    ReferralsAdminController,
    MemberReferralsController,
    MemberReferralsAdminController,
    B2BAnalyticsController,
    B2CAnalyticsController,
    MemberDashboardController,
    ReferralsInternalController,
  ],
  providers: [
    ReferralsService,
    RuleEngineService,
    RewardProcessorService,
    ReferralLifecycleService,
    ReferralFraudService,
    ReferralWalletService,
    ReferralAdminService,
    MemberReferralsService,
    MemberReferralAdminService,
    ReferralNotificationService,
    ReferralAnalyticsService,
    WalletRedemptionService,
    ReferralEventsListener,
    ReferralWalletJob,
    CronLockService,
  ],
  exports: [
    ReferralsService,
    ReferralLifecycleService,
    ReferralFraudService,
    ReferralWalletService,
    MemberReferralsService,
    ReferralAnalyticsService,
    WalletRedemptionService,
  ],
})
export class ReferralsModule {}
