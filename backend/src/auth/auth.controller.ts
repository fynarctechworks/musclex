import { Controller, Post, Get, Body, Headers, UseGuards, Req, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  OnboardingDto,
  RegisterDto,
  VerifyEmailDto,
  ResendVerificationDto,
  SelectPlanDto,
  SetupStudioDto,
  OnboardingBranchesDto,
  OnboardingMembershipsDto,
  OnboardingStaffListDto,
  OnboardingSkipStepDto,
  OnboardingPaymentDto,
  OAuthSyncDto,
} from './dto';
import { SelectWorkspaceDto } from './dto/select-workspace.dto';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../common';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── New Onboarding Flow ────────────────────────────────

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Get('plans')
  getPlans() {
    return this.authService.getPlans();
  }

  @Post('select-plan')
  @UseGuards(JwtAuthGuard)
  selectPlan(@CurrentUser() user: JwtPayload, @Body() dto: SelectPlanDto) {
    return this.authService.selectPlan(user.user_id, dto.plan_id);
  }

  @Post('setup-studio')
  @UseGuards(JwtAuthGuard)
  setupStudio(@CurrentUser() user: JwtPayload, @Body() dto: SetupStudioDto) {
    return this.authService.setupStudio(user.user_id, dto);
  }

  @Post('onboarding/branches')
  @UseGuards(JwtAuthGuard)
  onboardingBranches(@CurrentUser() user: JwtPayload, @Body() dto: OnboardingBranchesDto) {
    return this.authService.onboardingBranches(user.user_id, dto);
  }

  @Post('onboarding/memberships')
  @UseGuards(JwtAuthGuard)
  onboardingMemberships(@CurrentUser() user: JwtPayload, @Body() dto: OnboardingMembershipsDto) {
    return this.authService.onboardingMemberships(user.user_id, dto);
  }

  @Post('onboarding/staff')
  @UseGuards(JwtAuthGuard)
  onboardingStaff(@CurrentUser() user: JwtPayload, @Body() dto: OnboardingStaffListDto) {
    return this.authService.onboardingStaff(user.user_id, dto);
  }

  @Post('onboarding/subscription')
  @UseGuards(JwtAuthGuard)
  onboardingSubscription(@CurrentUser() user: JwtPayload, @Body() dto: SelectPlanDto) {
    return this.authService.onboardingSelectSubscription(user.user_id, dto.plan_id, dto.billing_cycle);
  }

  @Post('onboarding/payment')
  @UseGuards(JwtAuthGuard)
  onboardingPayment(@CurrentUser() user: JwtPayload, @Body() dto: OnboardingPaymentDto) {
    return this.authService.onboardingRecordPayment(user.user_id, dto);
  }

  @Post('onboarding/skip')
  @UseGuards(JwtAuthGuard)
  onboardingSkip(@CurrentUser() user: JwtPayload, @Body() dto: OnboardingSkipStepDto) {
    return this.authService.onboardingSkipStep(user.user_id, dto);
  }

  // ── Existing Endpoints ─────────────────────────────────

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] || undefined;
    return this.authService.login(dto, { ip_address: ip, user_agent: userAgent });
  }

  // ── OAuth sign-in sync (Google / Apple) ───────────────
  // Public: the Supabase session is verified server-side inside the service,
  // so this must NOT use JwtAuthGuard (a brand-new social user has no local
  // identity row yet — the guard would reject them before sync can create it).
  @Post('oauth/sync')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  oauthSync(@Body() dto: OAuthSyncDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] || undefined;
    return this.authService.oauthSync(
      dto.access_token,
      dto.refresh_token,
      { ip_address: ip, user_agent: userAgent },
      dto.device_info,
    );
  }

  @Post('logout')
  logout(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '') || '';
    return this.authService.logout(token);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.user_id);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('onboarding')
  onboarding(@Body() dto: OnboardingDto) {
    return this.authService.onboarding(dto);
  }

  // ── Workspace Selection (multi-studio users) ──────────

  @Post('select-workspace')
  @UseGuards(JwtAuthGuard)
  selectWorkspace(
    @CurrentUser() user: JwtPayload,
    @Body() body: SelectWorkspaceDto,
  ) {
    return this.authService.selectWorkspace(user.user_id, body.studio_id, body.branch_id);
  }
}
