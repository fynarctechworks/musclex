import { Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberExerciseService } from './member-exercise.service';

/**
 * Exercise Library endpoints (Member App V2.2): browse/search the gym catalog,
 * read one exercise's detail, and favorite/unfavorite. Reads are gym-scoped;
 * favorites are member-owned. Favorite toggles are idempotent.
 */
@MemberDataController()
export class MemberExerciseController {
  constructor(private readonly exercises: MemberExerciseService) {}

  @Get('exercises')
  list(
    @CurrentMember() member: CurrentMemberContext,
    @Query('q') q?: string,
    @Query('muscle') muscle?: string,
    @Query('favorites') favorites?: string,
  ) {
    return this.exercises.list(member, q, muscle, favorites === 'true');
  }

  @Get('exercises/:exerciseId')
  detail(
    @CurrentMember() member: CurrentMemberContext,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.exercises.detail(member, exerciseId);
  }

  @Put('exercises/:exerciseId/favorite')
  @HttpCode(200)
  favorite(
    @CurrentMember() member: CurrentMemberContext,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.exercises.favorite(member, exerciseId);
  }

  @Delete('exercises/:exerciseId/favorite')
  @HttpCode(200)
  unfavorite(
    @CurrentMember() member: CurrentMemberContext,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.exercises.unfavorite(member, exerciseId);
  }
}
