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
import { ResourceLimitService } from '../common/services/resource-limit.service';

@Module({
  imports: [PrismaModule],
  // ORDER MATTERS. Nest registers routes in this order and Express matches
  // first-wins, so every controller with a STATIC path under `api/v1/classes`
  // must come before ClassesController — which owns `api/v1/classes/:id`.
  // Registered after it, `/classes/sessions` matched `classes/:id` with
  // id="sessions" and Prisma failed parsing "sessions" as a UUID (500).
  controllers: [
    SessionController,
    ClassTemplateController,
    BookingController,
    ClassesController,
  ],
  providers: [
    ClassesService,
    ClassTemplateService,
    SchedulingService,
    BookingService,
    AttendanceService,
    CronLockService,
    ResourceLimitService,
  ],
  exports: [
    // Exposed for the Member BFF (member self-booking reuses the same
    // capacity/waitlist/duplicate rules as the front-desk path).
    ClassesService,
    ClassTemplateService,
    SchedulingService,
    BookingService,
    AttendanceService,
  ],
})
export class ClassesModule {}
