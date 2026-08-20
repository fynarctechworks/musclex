import { Get, HttpCode, Param, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberExploreService } from './member-explore.service';

/**
 * Explore: browse the curated library and add a workout to your own routines.
 *
 * Browsing needs no gym scope — the content is central and identical for
 * everyone. Adding does, because the result is a routine in the member's gym.
 */
@MemberDataController()
export class MemberExploreController {
  constructor(private readonly explore: MemberExploreService) {}

  @Get('explore')
  browse() {
    return this.explore.browse();
  }

  @Get('explore/:slug')
  detail(@Param('slug') slug: string) {
    return this.explore.detail(slug);
  }

  @Post('explore/:slug/add')
  @HttpCode(201)
  add(@CurrentMember() member: CurrentMemberContext, @Param('slug') slug: string) {
    return this.explore.addToRoutines(member, slug);
  }
}
