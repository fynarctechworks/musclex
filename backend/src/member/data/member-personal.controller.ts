import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PublicMemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { tzOffset } from '../common/tz';
import { MemberPersonalService } from './member-personal.service';
import {
  PersonalExerciseCreateDto,
  PersonalMealCreateDto,
  PersonalRoutineCreateDto,
  PersonalRoutineUpdateDto,
} from './dto';

/**
 * Routines, exercises and meals for ANY authenticated member, gym or no gym.
 *
 * PublicMemberDataController deliberately: this is the surface that made the
 * independent member possible. It has no GymMemberGuard, so every handler must
 * scope by the token's appUserId and must never touch a studio-scoped model —
 * both of which the service does.
 *
 * A gym member reaching these gets their OWN personal routines and meals, kept
 * separate from anything their trainer set inside the gym. That is intentional:
 * merging the two would mean a gym could see food a member logged before they
 * ever joined.
 */
@PublicMemberDataController()
export class MemberPersonalController {
  constructor(private readonly personal: MemberPersonalService) {}

  /* ── Exercises ──────────────────────────────────────────── */

  @Get('me/exercises')
  exercises(@CurrentMember() member: CurrentMemberContext, @Query('q') q?: string) {
    return this.personal.exercises(member, q);
  }

  @Post('me/exercises')
  createExercise(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: PersonalExerciseCreateDto,
  ) {
    return this.personal.createExercise(member, dto);
  }

  /* ── Routines ───────────────────────────────────────────── */

  @Get('me/routines')
  routines(@CurrentMember() member: CurrentMemberContext) {
    return this.personal.routines(member);
  }

  @Get('me/routines/:id')
  routine(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.personal.routine(member, id);
  }

  @Post('me/routines')
  createRoutine(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: PersonalRoutineCreateDto,
  ) {
    return this.personal.createRoutine(member, dto);
  }

  @Patch('me/routines/:id')
  updateRoutine(
    @CurrentMember() member: CurrentMemberContext,
    @Param('id') id: string,
    @Body() dto: PersonalRoutineUpdateDto,
  ) {
    return this.personal.updateRoutine(member, id, dto);
  }

  @Delete('me/routines/:id')
  deleteRoutine(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.personal.deleteRoutine(member, id);
  }

  /* ── Meals ──────────────────────────────────────────────── */

  @Get('me/meals')
  meals(
    @CurrentMember() member: CurrentMemberContext,
    @Query('day') day?: string,
    @Query('tz') tz?: string,
  ) {
    return this.personal.meals(member, day, tzOffset(tz));
  }

  @Post('me/meals')
  logMeal(@CurrentMember() member: CurrentMemberContext, @Body() dto: PersonalMealCreateDto) {
    return this.personal.logMeal(member, dto);
  }

  @Delete('me/meals/:id')
  deleteMeal(@CurrentMember() member: CurrentMemberContext, @Param('id') id: string) {
    return this.personal.deleteMeal(member, id);
  }
}
