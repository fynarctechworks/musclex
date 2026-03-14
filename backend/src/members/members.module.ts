import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberProfileService } from './member-profile.service';
import { MemberCrmService } from './member-crm.service';
import { MemberVisitsService } from './member-visits.service';
import { MemberVisitsController } from './member-visits.controller';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { MembershipService } from './membership.service';
import { RenewalsService } from './renewals.service';
import { FamilyMembershipService } from './family-membership.service';
import { CorporateMembershipService } from './corporate-membership.service';
import { MembershipsController } from './memberships.controller';
import { FamilyController } from './family.controller';
import { CorporateController } from './corporate.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CronLockService } from '../common/services/cron-lock.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    MembersController,
    MemberVisitsController,
    PlansController,
    MembershipsController,
    FamilyController,
    CorporateController,
  ],
  providers: [
    MembersService,
    MemberProfileService,
    MemberCrmService,
    MemberVisitsService,
    PlansService,
    MembershipService,
    RenewalsService,
    FamilyMembershipService,
    CorporateMembershipService,
    CronLockService,
  ],
  exports: [
    MembersService,
    MemberProfileService,
    MemberCrmService,
    MemberVisitsService,
    PlansService,
    MembershipService,
    RenewalsService,
    FamilyMembershipService,
    CorporateMembershipService,
  ],
})
export class MembersModule {}
