import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { LeadsController } from './leads.controller';
import { AutomationController } from './automation.controller';
import { MarketingService } from './marketing.service';
import { LeadsService } from './leads.service';
import { AutomationService } from './automation.service';
import { CampaignSenderService } from './campaign-sender.service';
import { AutomationDispatcherService } from './automation-dispatcher.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MembersModule } from '../members/members.module';
import { ResourceLimitService } from '../common/services/resource-limit.service';
import { CronLockService } from '../common/services/cron-lock.service';

@Module({
  imports: [PrismaModule, MembersModule],
  controllers: [MarketingController, LeadsController, AutomationController],
  providers: [
    MarketingService,
    LeadsService,
    AutomationService,
    CampaignSenderService,
    AutomationDispatcherService,
    ResourceLimitService,
    CronLockService,
  ],
  exports: [MarketingService, LeadsService, AutomationService, CampaignSenderService],
})
export class MarketingModule {}
