import { Get, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberTrainingService } from './member-training.service';
import { tzOffset } from '../common/tz';

/**
 * Training load, form, and predictions.
 *
 * MemberDataController rather than the public one: the strength predictions
 * read sets from the member's GYM schema, so this needs a gym-scoped context.
 * The load and race endpoints would work without one, but splitting them
 * across two controllers to save a guard would be worse than the guard.
 */
@MemberDataController()
export class MemberTrainingController {
  constructor(private readonly training: MemberTrainingService) {}

  /** Fitness, fatigue and form. `tz` so days are the member's own. */
  @Get('training/load')
  load(
    @CurrentMember() member: CurrentMemberContext,
    @Query('days') days?: string,
    @Query('tz') tz?: string,
  ) {
    const n = Number(days);
    return this.training.load(
      member,
      tzOffset(tz),
      Number.isFinite(n) && n > 0 ? n : undefined,
    );
  }

  @Get('training/races')
  races(@CurrentMember() member: CurrentMemberContext) {
    return this.training.racePredictions(member);
  }

  /** Projected one-rep max per lift — the half Strava cannot do. */
  @Get('training/strength')
  strength(@CurrentMember() member: CurrentMemberContext) {
    return this.training.strengthPredictions(member);
  }

  @Get('training/zones')
  zones(
    @CurrentMember() _member: CurrentMemberContext,
    @Query('hrMax') hrMax?: string,
    @Query('hrRest') hrRest?: string,
  ) {
    const max = Number(hrMax);
    const rest = Number(hrRest);
    return this.training.zones(
      Number.isFinite(max) && max > 100 && max < 230 ? max : undefined,
      Number.isFinite(rest) && rest > 25 && rest < 120 ? rest : undefined,
    );
  }
}
