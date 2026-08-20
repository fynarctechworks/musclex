import { Body, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberExerciseService } from './member-exercise.service';
import { CustomExerciseDto } from './dto';

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
    @Query('equipment') equipment?: string,
    @Query('target') target?: string,
  ) {
    return this.exercises.list(
      member,
      q,
      muscle,
      favorites === 'true',
      equipment,
      target,
    );
  }

  /** Create a personal exercise. Declared before the :exerciseId routes below
   *  is unnecessary for POST, but keeps the custom-exercise pair together. */
  @Post('exercises')
  @HttpCode(201)
  createCustom(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: CustomExerciseDto,
  ) {
    return this.exercises.createCustom(member, dto);
  }

  @Delete('exercises/:exerciseId/custom')
  deleteCustom(
    @CurrentMember() member: CurrentMemberContext,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.exercises.deleteCustom(member, exerciseId);
  }

  @Get('exercises/:exerciseId')
  detail(
    @CurrentMember() member: CurrentMemberContext,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.exercises.detail(member, exerciseId);
  }

  @Get('exercises/:exerciseId/history')
  history(
    @CurrentMember() member: CurrentMemberContext,
    @Param('exerciseId') exerciseId: string,
    @Query('limit') limit?: string,
  ) {
    return this.exercises.history(member, exerciseId, Number(limit) || 10);
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
