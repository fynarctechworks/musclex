import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SccSyncService } from '../common/services/scc-sync.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [SettingsController],
  providers: [SettingsService, SccSyncService],
})
export class SettingsModule {}
