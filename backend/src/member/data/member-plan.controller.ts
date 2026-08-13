import { Get } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberPlanService } from './member-plan.service';

/**
 * GET member/v1/plans — the member's prescribed diet plan (with meals) and
 * upcoming trainer-assigned workouts.
 */
@MemberDataController()
export class MemberPlanController {
  constructor(private readonly plans: MemberPlanService) {}

  @Get('plans')
  myPlans(@CurrentMember() member: CurrentMemberContext) {
    return this.plans.getMyPlans(member);
  }
}
