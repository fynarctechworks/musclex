import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkoutPlansController } from './workout-plans.controller';
import { DietPlansController } from './diet-plans.controller';
import { ExercisesController } from './exercises.controller';
import { WorkoutPlansService } from './workout-plans.service';
import { DietPlansService } from './diet-plans.service';
import { StaffResolverService } from './staff-resolver.service';
import { ExercisesService } from './exercises.service';

/**
 * Trainer-assigned training + diet plans (staff side). The member BFF exposes
 * the member-facing reads (member/v1/workouts/today, member/v1/plans).
 */
@Module({
  imports: [PrismaModule],
  controllers: [WorkoutPlansController, DietPlansController, ExercisesController],
  providers: [WorkoutPlansService, DietPlansService, StaffResolverService, ExercisesService],
  exports: [WorkoutPlansService, DietPlansService, ExercisesService],
})
export class PlansModule {}
