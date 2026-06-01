import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckInsModule } from '../check-ins/check-ins.module';
import { MemberTokenService } from './auth/member-token.service';
import { MemberSupabaseAuthService } from './auth/member-supabase-auth.service';
import { MemberAuthService } from './auth/member-auth.service';
import { MemberAuthController } from './auth/member-auth.controller';
import { MemberDirectoryService } from './directory/member-directory.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { MemberJwtGuard } from './guards/member-jwt.guard';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { EnvelopeInterceptor } from './interceptors/envelope.interceptor';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { MemberDataService } from './data/member-data.service';
import { MemberCheckInService } from './data/member-checkin.service';
import { MemberWorkoutService } from './data/member-workout.service';
import { MemberCoreController } from './data/member-core.controller';
import { MemberCheckInController } from './data/member-checkin.controller';
import { MemberWorkoutController } from './data/member-workout.controller';

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
  imports: [ConfigModule, PrismaModule, CheckInsModule],
  controllers: [
    MemberAuthController,
    MemberCoreController,
    MemberCheckInController,
    MemberWorkoutController,
  ],
  providers: [
    MemberTokenService,
    MemberSupabaseAuthService,
    MemberAuthService,
    MemberDirectoryService,
    IdempotencyService,
    MemberDataService,
    MemberCheckInService,
    MemberWorkoutService,
    MemberJwtGuard,
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
