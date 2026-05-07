import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralsService } from './referrals.service';
import { RuleEngineService } from './rule-engine.service';
import { RewardProcessorService } from './reward-processor.service';
import { ReferralEventsListener } from './referral-events.listener';
import { ReferralsController } from './referrals.controller';
import { ReferralsAdminController } from './referrals-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReferralsController, ReferralsAdminController],
  providers: [
    ReferralsService,
    RuleEngineService,
    RewardProcessorService,
    ReferralEventsListener,
  ],
  exports: [ReferralsService],
})
export class ReferralsModule {}
