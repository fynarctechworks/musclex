import { Body, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberWorkoutService } from './member-workout.service';
import { WorkoutLogDto } from './dto';

/**
 * Workout core-loop endpoints: read today's trainer-assigned workout and post
 * completed sets. The member is always resolved from @CurrentMember; the path
 * workoutId is ownership-checked server-side before any write.
 */
@MemberDataController()
export class MemberWorkoutController {
  constructor(private readonly workouts: MemberWorkoutService) {}

  @Get('workouts/today')
  today(@CurrentMember() member: CurrentMemberContext) {
    return this.workouts.getTodayWorkout(member);
  }

  @Post('workouts/:workoutId/logs')
  @HttpCode(201)
  @Idempotent()
  log(
    @CurrentMember() member: CurrentMemberContext,
    @Param('workoutId') workoutId: string,
    @Body() dto: WorkoutLogDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.workouts.logWorkout(member, workoutId, dto.sets, idempotencyKey);
  }
}
