import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { TrainerController } from './trainer.controller';
import { TrainerService } from './trainer.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StaffController, TrainerController, PayrollController],
  providers: [StaffService, TrainerService, PayrollService],
  exports: [StaffService, TrainerService, PayrollService],
})
export class StaffModule {}
