import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckInsModule } from '../check-ins/check-ins.module';
import { ClassesModule } from '../classes/classes.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuditModule } from '../audit/audit.module';
import { MemberTokenService } from './auth/member-token.service';
import { MemberSupabaseAuthService } from './auth/member-supabase-auth.service';
import { MemberAuthService } from './auth/member-auth.service';
import { MemberAuthController } from './auth/member-auth.controller';
import { MemberDirectoryService } from './directory/member-directory.service';
import { AppUserService } from './app-user/app-user.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { MemberJwtGuard } from './guards/member-jwt.guard';
import { GymMemberGuard } from './guards/gym-member.guard';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { EnvelopeInterceptor } from './interceptors/envelope.interceptor';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { MemberDataService } from './data/member-data.service';
import { MemberBillingService } from './data/member-billing.service';
import { MemberProgressPhotoService } from './data/member-progress-photo.service';
import { MemberAvatarService } from './data/member-avatar.service';
import { PersonalizationService } from './data/personalization.service';
import { MemberStreakService } from './data/member-streak.service';
import { MemberCheckInService } from './data/member-checkin.service';
import { MemberWorkoutService } from './data/member-workout.service';
import { MemberPlanService } from './data/member-plan.service';
import { MemberCoachService } from './data/member-coach.service';
import { MemberClassService } from './data/member-class.service';
import { MemberNutritionService } from './data/member-nutrition.service';
import { MemberExerciseService } from './data/member-exercise.service';
import { MemberChatService } from './data/member-chat.service';
import { MemberChatGateway } from './data/member-chat.gateway';
import { MemberNotificationService } from './data/member-notification.service';
import { MemberCommunityService } from './data/member-community.service';
import { MemberHealthService } from './data/member-health.service';
import { MemberIdentityService } from './data/member-identity.service';
import { MemberContextService } from './data/member-context.service';
import { MemberPublicHealthService } from './data/member-public-health.service';
import { MemberEventsService } from './data/member-events.service';
import { MemberDiscoveryService } from './data/member-discovery.service';
import { MemberPublicProfileService } from './data/member-public-profile.service';
import { MemberCoreController } from './data/member-core.controller';
import { MemberPublicController } from './data/member-public.controller';
import { MemberCheckInController } from './data/member-checkin.controller';
import { MemberWorkoutController } from './data/member-workout.controller';
import { MemberPlanController } from './data/member-plan.controller';
import { MemberCoachController } from './data/member-coach.controller';
import { MemberClassController } from './data/member-class.controller';
import { MemberNutritionController } from './data/member-nutrition.controller';
import { MemberExerciseController } from './data/member-exercise.controller';
import { MemberRoutineController } from './data/member-routine.controller';
import { MemberActivityController } from './data/member-activity.controller';
import { MemberChallengeController } from './data/member-challenge.controller';
import { MemberChallengeService } from './data/member-challenge.service';
import { MemberClubController } from './data/member-club.controller';
import { MemberClubService } from './data/member-club.service';
import { MemberFeedController } from './data/member-feed.controller';
import { MemberMessageController } from './data/member-message.controller';
import { MemberPeopleController } from './data/member-people.controller';
import { MemberRouteController } from './data/member-route.controller';
import { MemberRouteService } from './data/member-route.service';
import { MemberPeopleService } from './data/member-people.service';
import { MemberMessageService } from './data/member-message.service';
import { MemberFeedService } from './data/member-feed.service';
import { MemberActivityService } from './data/member-activity.service';
import { MemberFriendController } from './data/member-friend.controller';
import { MemberFriendService } from './data/member-friend.service';
import { FriendPublisherService } from './data/friend-publisher.service';
import { MemberExploreController } from './data/member-explore.controller';
import { MemberExploreService } from './data/member-explore.service';
import { MemberRoutineService } from './data/member-routine.service';
import { MemberChatController } from './data/member-chat.controller';
import { MemberNotificationController } from './data/member-notification.controller';
import { MemberCommunityController } from './data/member-community.controller';
import { MemberHealthController } from './data/member-health.controller';
import { MemberIdentityController } from './data/member-identity.controller';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER BFF MODULE
 * ────────────────────────────────────────────────────────────────
 *
 * The member-facing Backend-For-Frontend. Lives inside the existing SaaS and
 * reuses its Prisma layer + tenant scoping; it does NOT fork the data layer and
 * does NOT touch the admin API.
 *
 * Guards/interceptors are provided here and applied PER-CONTROLLER (never as
 * global APP_GUARD/APP_INTERCEPTOR) so admin routes are completely unaffected.
 * Data controllers (step 4) compose:
 *   @UseGuards(MemberJwtGuard)
 *   @UseInterceptors(TenantContextInterceptor, IdempotencyInterceptor, EnvelopeInterceptor)
 *   @UseFilters(MemberExceptionFilter)
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CheckInsModule,
    ClassesModule,
    PaymentsModule,
    AuditModule,
  ],
  controllers: [
    MemberAuthController,
    MemberCoreController,
    MemberPublicController,
    MemberCheckInController,
    MemberWorkoutController,
    MemberPlanController,
    MemberCoachController,
    MemberClassController,
    MemberNutritionController,
    MemberExerciseController,
    MemberRoutineController,
    MemberActivityController,
    MemberChallengeController,
    MemberClubController,
    MemberFeedController,
    MemberMessageController,
    MemberPeopleController,
    MemberRouteController,
    MemberFriendController,
    MemberExploreController,
    MemberChatController,
    MemberNotificationController,
    MemberCommunityController,
    MemberHealthController,
    MemberIdentityController,
  ],
  providers: [
    MemberTokenService,
    MemberSupabaseAuthService,
    MemberAuthService,
    MemberDirectoryService,
    AppUserService,
    IdempotencyService,
    MemberDataService,
    MemberBillingService,
    MemberProgressPhotoService,
    MemberAvatarService,
    PersonalizationService,
    MemberStreakService,
    MemberCheckInService,
    MemberWorkoutService,
    MemberPlanService,
    MemberCoachService,
    MemberClassService,
    MemberNutritionService,
    MemberExerciseService,
    MemberRoutineService,
    MemberActivityService,
    MemberChallengeService,
    MemberClubService,
    MemberFeedService,
    MemberMessageService,
    MemberPeopleService,
    MemberRouteService,
    MemberFriendService,
    FriendPublisherService,
    MemberExploreService,
    MemberChatService,
    MemberChatGateway,
    MemberNotificationService,
    MemberCommunityService,
    MemberHealthService,
    MemberIdentityService,
    MemberContextService,
    MemberPublicHealthService,
    MemberEventsService,
    MemberDiscoveryService,
    MemberPublicProfileService,
    MemberJwtGuard,
    GymMemberGuard,
    TenantContextInterceptor,
    EnvelopeInterceptor,
    IdempotencyInterceptor,
  ],
  exports: [
    MemberTokenService,
    MemberDirectoryService,
    IdempotencyService,
    MemberJwtGuard,
    TenantContextInterceptor,
    EnvelopeInterceptor,
    IdempotencyInterceptor,
  ],
})
export class MemberModule {}
