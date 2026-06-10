import { Body, Get, Headers, HttpCode, Post, Put, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberNutritionService } from './member-nutrition.service';
import { MealLogDto, WaterLogDto, NutritionGoalDto } from './dto';

/**
 * Nutrition core-loop endpoints (Member App V2.1): read today's goal/totals/
 * meals/water, search the gym food catalog, log meals + water, set the daily
 * goal. The member is always resolved from @CurrentMember; writes are idempotent
 * for offline-outbox safety.
 */
@MemberDataController()
export class MemberNutritionController {
  constructor(private readonly nutrition: MemberNutritionService) {}

  @Get('nutrition/today')
  today(@CurrentMember() member: CurrentMemberContext) {
    return this.nutrition.getToday(member);
  }

  @Get('nutrition/foods')
  foods(
    @CurrentMember() member: CurrentMemberContext,
    @Query('q') q?: string,
  ) {
    return this.nutrition.searchFoods(member, q);
  }

  @Post('nutrition/meals')
  @HttpCode(201)
  @Idempotent()
  logMeal(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: MealLogDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.nutrition.logMeal(member, dto, idempotencyKey);
  }

  @Post('nutrition/water')
  @HttpCode(201)
  @Idempotent()
  logWater(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: WaterLogDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.nutrition.logWater(member, dto.amountMl, dto.loggedAt, idempotencyKey);
  }

  @Put('nutrition/goal')
  setGoal(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: NutritionGoalDto,
  ) {
    return this.nutrition.setGoal(member, dto);
  }
}
