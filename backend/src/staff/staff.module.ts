import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StaffController, StaffInviteController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffInviteService } from './staff-invite.service';
import { StaffBiometricsController } from './staff-biometrics.controller';
import { StaffBiometricsService } from './staff-biometrics.service';
import { TrainerController } from './trainer.controller';
import { TrainerService } from './trainer.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ResourceLimitService } from '../common/services/resource-limit.service';

@Module({
  imports: [PrismaModule, EventsModule, ConfigModule],
  controllers: [
    StaffController,
    StaffInviteController,
    StaffBiometricsController,
    TrainerController,
    PayrollController,
  ],
  providers: [
    StaffService,
    StaffInviteService,
    StaffBiometricsService,
    TrainerService,
    PayrollService,
    ResourceLimitService,
  ],
  exports: [
    StaffService,
    StaffInviteService,
    StaffBiometricsService,
    TrainerService,
    PayrollService,
  ],
})
export class StaffModule {}
