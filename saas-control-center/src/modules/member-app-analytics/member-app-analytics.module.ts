import { Module } from '@nestjs/common';
import { MemberAppAnalyticsService } from './member-app-analytics.service';
import { MemberAppCampaignsService } from './member-app-campaigns.service';
import { MemberAppAnalyticsController } from './member-app-analytics.controller';

@Module({
  providers: [MemberAppAnalyticsService, MemberAppCampaignsService],
  controllers: [MemberAppAnalyticsController],
})
export class MemberAppAnalyticsModule {}
