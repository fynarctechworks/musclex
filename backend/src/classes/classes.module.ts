import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassTemplateController } from './class-template.controller';
import { ClassTemplateService } from './class-template.service';
import { SessionController } from './session.controller';
import { SchedulingService } from './scheduling.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { AttendanceService } from './attendance.service';
import { CronLockService } from '../common/services/cron-lock.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ClassesController,
    ClassTemplateController,
    SessionController,
    BookingController,
  ],
  providers: [
    ClassesService,
    ClassTemplateService,
    SchedulingService,
    BookingService,
    AttendanceService,
    CronLockService,
  ],
  exports: [
    ClassTemplateService,
    SchedulingService,
    BookingService,
    AttendanceService,
  ],
})
export class ClassesModule {}
