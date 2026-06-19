import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { LeadsController } from './leads.controller';
import { AutomationController } from './automation.controller';
import { MarketingService } from './marketing.service';
import { LeadsService } from './leads.service';
import { AutomationService } from './automation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourceLimitService } from '../common/services/resource-limit.service';

@Module({
  imports: [PrismaModule],
  controllers: [MarketingController, LeadsController, AutomationController],
  providers: [MarketingService, LeadsService, AutomationService, ResourceLimitService],
  exports: [MarketingService, LeadsService, AutomationService],
})
export class MarketingModule {}
