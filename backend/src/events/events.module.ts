import { Module, forwardRef } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { EventProjectorService } from './event-projector.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [PrismaModule, forwardRef(() => DashboardModule)],
  providers: [EventStoreService, EventProjectorService],
  exports: [EventStoreService, EventProjectorService],
})
export class EventsModule {}
