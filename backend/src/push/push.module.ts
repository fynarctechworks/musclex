import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from './push.service';
import { StaffPushService } from './staff-push.service';
import { StaffPushController } from './staff-push.controller';

/** Global Expo push sender for staff-triggered member pushes. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [StaffPushController],
  providers: [PushService, StaffPushService],
  exports: [PushService, StaffPushService],
})
export class PushModule {}
