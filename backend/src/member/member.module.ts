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
import { MemberClassService } from './data/member-class.service';
import { MemberNutritionService } from './data/member-nutrition.service';
import { MemberExerciseService } from './data/member-exercise.service';
import { MemberChatService } from './data/member-chat.service';
import { MemberChatGateway } from './data/member-chat.gateway';
import { MemberNotificationService } from './data/member-notification.service';
import { MemberCommunityService } from './data/member-community.service';
import { MemberHealthService } from './data/member-health.service';
import { MemberContextService } from './data/member-context.service';
import { MemberPublicHealthService } from './data/member-public-health.service';
import { MemberEventsService } from './data/member-events.service';
import { MemberDiscoveryService } from './data/member-discovery.service';
import { MemberPublicProfileService } from './data/member-public-profile.service';
import { MemberCoreController } from './data/member-core.controller';
import { MemberPublicController } from './data/member-public.controller';
import { MemberCheckInController } from './data/member-checkin.controller';
import { MemberWorkoutController } from './data/member-workout.controller';
import { MemberClassController } from './data/member-class.controller';
import { MemberNutritionController } from './data/member-nutrition.controller';
import { MemberExerciseController } from './data/member-exercise.controller';
import { MemberChatController } from './data/member-chat.controller';
import { MemberNotificationController } from './data/member-notification.controller';
import { MemberCommunityController } from './data/member-community.controller';
import { MemberHealthController } from './data/member-health.controller';

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
    MemberClassController,
    MemberNutritionController,
    MemberExerciseController,
    MemberChatController,
    MemberNotificationController,
    MemberCommunityController,
    MemberHealthController,
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
    MemberClassService,
    MemberNutritionService,
    MemberExerciseService,
    MemberChatService,
    MemberChatGateway,
    MemberNotificationService,
    MemberCommunityService,
    MemberHealthService,
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
