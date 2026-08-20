import { Body, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
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

  /** Training statistics over a window (default 30 days). */
  @Get('workouts/stats')
  stats(
    @CurrentMember() member: CurrentMemberContext,
    @Query('days') days?: string,
  ) {
    const n = Number(days);
    return this.workouts.stats(member, Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 30);
  }

  @Get('workouts/today')
  today(@CurrentMember() member: CurrentMemberContext) {
    return this.workouts.getTodayWorkout(member);
  }

  /**
   * Freestyle log — a session the member started themselves. Declared before
   * the parameterised route below because Nest matches in registration order
   * and `workouts/logs` would otherwise be swallowed by `workouts/:workoutId`.
   */
  @Post('workouts/logs')
  @HttpCode(201)
  @Idempotent()
  logFreestyle(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: WorkoutLogDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.workouts.logFreestyle(member, dto.sets, idempotencyKey, {
      startedAt: dto.startedAt,
      endedAt: dto.endedAt,
    });
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
    return this.workouts.logWorkout(member, workoutId, dto.sets, idempotencyKey, {
      startedAt: dto.startedAt,
      endedAt: dto.endedAt,
    });
  }
}
