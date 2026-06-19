import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { tenantContext } from '../common/tenant-context';
import { EmailService } from '../email/email.service';
import { EmailTemplateId } from '../email/email.types';
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
} from './dto';
import { PLAN_CONFIGS, fetchAvailablePlans } from '../common/plan-configs';
import { DEFAULT_TIMEZONE, DEFAULT_CURRENCY, DEFAULT_PLAN } from '../common/defaults';
import { SccSyncService } from '../common/services/scc-sync.service';
import { AuthIdentityService } from './auth-identity.service';
import { AuthDeviceService } from './auth-device.service';
import { AuthLoginHistoryService } from './auth-login-history.service';
import { AuthSessionService } from './auth-session.service';
import { RbacService } from './rbac.service';
import { RbacSeedService } from './rbac-seed.service';
import { TwoFactorService } from './two-factor.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  REFERRAL_EVENTS,
  SubscriptionActivatedPayload,
} from '../referrals/events/domain-events';
import { SubscriptionPolicyService } from '../common/services/subscription-policy.service';
import { RazorpayService } from '../payments/razorpay.service';

/** Request context passed from the controller for tracking. */
export interface LoginContext {
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    // Registry (public-schema) models route through the dedicated public client.
    // Tenant models (organization/branch/staff) + raw SQL stay on `prisma` until
    // their Phase 7/8 slices. See PER_GYM_SCHEMA_IMPL_STATUS.md.
    private pub: PublicPrismaService,
    private identityService: AuthIdentityService,
    private deviceService: AuthDeviceService,
    private loginHistoryService: AuthLoginHistoryService,
    private sessionService: AuthSessionService,
    private rbacService: RbacService,
    private rbacSeedService: RbacSeedService,
    private twoFactorService: TwoFactorService,
    private eventEmitter: EventEmitter2,
    private sccSync: SccSyncService,
    private subscriptionPolicy: SubscriptionPolicyService,
    private razorpay: RazorpayService,
    private emailService: EmailService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  /**
   * Reconcile the stored `onboarding_step` flag against actual database state.
   *
   * `onboarding_step` lives in Supabase `user_metadata` and is advanced manually
   * by each onboarding step. That flag can drift from reality — e.g. a studio
   * created via seed/SQL/admin/MCP writes the `studios` + `branches` tables but
   * never touches the flag, leaving the owner stuck mid-wizard on every login.
   *
   * The source of truth is the data, not the flag: if the user already owns a
   * studio with at least one branch, onboarding is effectively complete. When
   * the flag disagrees, we repair it in metadata once (self-healing) so it stays
   * in sync going forward and this misroute can never recur.
   *
   * Fresh users (no studio, or studio without a branch) keep their real step, so
   * mandatory setup is still enforced.
   *
   * @returns the effective onboarding step the caller should act on.
   */
  private async reconcileOnboardingStep(
    userId: string,
    metadata: Record<string, any>,
  ): Promise<string | undefined> {
    const storedStep = metadata.onboarding_step;
    const studioId = metadata.studio_id;

    // No studio yet → genuinely still onboarding; trust the stored step.
    if (!studioId) return storedStep;

    // Already complete → nothing to reconcile.
    if (storedStep === 'complete') return storedStep;

    try {
      const studio = await this.pub.studio.findUnique({
        where: { id: studioId },
        select: { id: true },
      });
      if (!studio) return storedStep; // dangling studio_id — leave as-is.

      const branchCount = await this.prisma.branch.count({
        where: { gym_id: studioId },
      });

      // Studio + at least one branch = a usable gym. Treat as complete and
      // heal the stale flag so the redirect loop ends permanently.
      if (branchCount > 0) {
        if (storedStep !== 'complete') {
          await this.supabase.auth.admin.updateUserById(userId, {
            user_metadata: { ...metadata, onboarding_step: 'complete' },
          });
          metadata.onboarding_step = 'complete';
          this.logger.log(
            `Reconciled onboarding_step → complete for user ${userId} (studio ${studioId} already set up)`,
          );
        }
        return 'complete';
      }
    } catch (err) {
      // Never block login on reconciliation failure — fall back to stored flag.
      this.logger.warn(
        `Onboarding reconciliation failed for user ${userId}: ${(err as Error).message}`,
      );
    }

    return storedStep;
  }

  async login(dto: LoginDto, context?: LoginContext) {
    const ip = context?.ip_address;
    const ua = context?.user_agent;

    // ── Persistent lockout check (DB-backed, survives restarts) ──
    const lockState = await this.identityService.isAccountLocked(dto.email);
    if (lockState.locked) {
      await this.loginHistoryService.record({
        email: dto.email,
        ip_address: ip,
        user_agent: ua,
        status: 'locked',
        failure_reason: 'Account locked due to repeated failed attempts',
      });
      throw new UnauthorizedException(
        `Account locked. Try again in ${lockState.minutes_remaining} minutes.`,
      );
    }

    // ── IP-level brute force check ──
    if (ip) {
      const ipFailures = await this.loginHistoryService.getIpFailedCount(ip, 60);
      if (ipFailures >= 50) {
        await this.loginHistoryService.record({
          email: dto.email,
          ip_address: ip,
          user_agent: ua,
          status: 'blocked',
          failure_reason: 'IP rate limit exceeded',
        });
        throw new UnauthorizedException('Too many login attempts. Please try again later.');
      }
    }

    // ── Authenticate via Supabase ──
    let data, error;
    try {
      const result = await this.supabase.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });
      data = result.data;
      error = result.error;
    } catch (err) {
      this.logger.error(`Supabase auth error: ${err.message}`);
      throw new InternalServerErrorException('Authentication service unavailable');
    }

    if (error || !data.user) {
      // Detect unconfirmed email
      if (error?.message?.toLowerCase().includes('email not confirmed')) {
        await this.loginHistoryService.record({
          email: dto.email,
          ip_address: ip,
          user_agent: ua,
          status: 'failed',
          failure_reason: 'email_not_confirmed',
        });
        throw new UnauthorizedException(
          'Please verify your email before signing in. Check your inbox for the verification link.',
        );
      }

      // Record persistent failed attempt
      const lockResult = await this.identityService.recordFailedLogin(dto.email);
      await this.loginHistoryService.record({
        email: dto.email,
        ip_address: ip,
        user_agent: ua,
        status: lockResult.is_locked ? 'locked' : 'failed',
        failure_reason: 'invalid_credentials',
      });

      if (lockResult.is_locked) {
        throw new UnauthorizedException(
          'Account locked due to repeated failed attempts. Try again in 15 minutes.',
        );
      }

      throw new UnauthorizedException('Invalid email or password');
    }

    // ── Successful authentication ── delegate to the shared post-auth pipeline.
    return this.buildAuthenticatedResponse(
      {
        id: data.user.id,
        email: data.user.email ?? null,
        user_metadata: data.user.user_metadata || {},
        email_confirmed_at: data.user.email_confirmed_at ?? null,
      },
      data.session ?? null,
      dto.email,
      context,
      dto.device_info,
    );
  }

  /**
   * Shared post-authentication pipeline used by BOTH password login and OAuth
   * sign-in. Given an already-verified Supabase user + session, it syncs the
   * local identity (so the JWT guard can find the user), tracks the device,
   * intercepts 2FA, records login history, bumps SCC activity, reconciles the
   * onboarding step, and resolves RBAC/workspaces — then returns the normalized
   * auth payload the frontend consumes (identical shape for both entry points).
   */
  private async buildAuthenticatedResponse(
    user: {
      id: string;
      email: string | null;
      user_metadata: Record<string, any>;
      email_confirmed_at?: string | null;
    },
    session: { access_token?: string; refresh_token?: string } | null,
    loginEmail: string,
    context?: LoginContext,
    deviceInfo?: LoginDto['device_info'],
  ) {
    const ip = context?.ip_address;
    const ua = context?.user_agent;

    const metadata = user.user_metadata || {};
    // Derive the real onboarding step from data, healing a stale flag if a
    // studio already exists (e.g. gym created via seed/SQL/admin). This prevents
    // already-set-up owners from being bounced back into the onboarding wizard.
    const onboardingStep = await this.reconcileOnboardingStep(user.id, metadata);

    // Sync identity to local table (persistent user record)
    await this.identityService.syncIdentity({
      id: user.id,
      email: user.email!,
      full_name: metadata.full_name || '',
      phone: metadata.phone,
      email_verified: !!user.email_confirmed_at,
    });

    // Track device
    let deviceId: string | undefined;
    const device = await this.deviceService.trackDevice(user.id, {
      device_fingerprint: deviceInfo?.device_fingerprint,
      device_name: deviceInfo?.device_name,
      device_type: deviceInfo?.device_type,
      user_agent: ua,
      ip_address: ip,
    });
    if (device.id) deviceId = device.id;

    // ── 2FA challenge interception ──
    const identity2fa = await this.pub.userIdentity.findUnique({
      where: { id: user.id },
      select: { two_factor_enabled: true },
    });
    if (identity2fa?.two_factor_enabled) {
      // Keep the Supabase session alive — pass encrypted tokens to temp JWT
      // They'll be returned after successful OTP verification
      const tempToken = await this.twoFactorService.generateTempToken(
        user.id,
        user.email!,
        session?.access_token && session?.refresh_token ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        } : undefined,
      );

      await this.loginHistoryService.record({
        user_id: user.id,
        email: loginEmail,
        ip_address: ip,
        user_agent: ua,
        device_id: deviceId,
        status: 'success',
        metadata: { step: '2fa_challenge_issued' },
      });

      return {
        requires_2fa: true,
        temp_token: tempToken,
      };
    }

    // Create session record
    let sessionId: string | undefined;
    if (session?.access_token) {
      sessionId = await this.sessionService.createSession({
        user_id: user.id,
        access_token: session.access_token,
        device_id: deviceId,
        ip_address: ip,
        studio_id: metadata.studio_id,
      });
    }

    // Record successful login
    await this.loginHistoryService.record({
      user_id: user.id,
      email: loginEmail,
      ip_address: ip,
      user_agent: ua,
      device_id: deviceId,
      status: 'success',
      studio_id: metadata.studio_id,
    });

    // Bump scc.tenants.last_active_at so the Control Center reflects real gym
    // activity. Fire-and-forget (non-blocking) + non-fatal — never let a sync
    // hiccup slow or fail a login.
    if (metadata.studio_id) {
      this.pub.studio
        .findUnique({ where: { id: metadata.studio_id }, select: { slug: true } })
        .then((s) => (s?.slug ? this.sccSync.touchLastActive(s.slug) : undefined))
        .catch(() => undefined);
    }

    // If still onboarding, return minimal data with step indicator
    if (onboardingStep && onboardingStep !== 'complete') {
      // If user can log in, their email is verified — skip past verify_email step
      const effectiveStep = onboardingStep === 'verify_email' ? 'studio_info' : onboardingStep;
      if (effectiveStep !== onboardingStep) {
        await this.supabase.auth.admin.updateUserById(user.id, {
          user_metadata: { ...metadata, onboarding_step: effectiveStep },
        });
      }

      return {
        access_token: session?.access_token,
        refresh_token: session?.refresh_token,
        session_id: sessionId,
        user: {
          id: user.id,
          email: user.email,
          full_name: metadata.full_name,
          role: metadata.role || 'owner',
          studio_id: metadata.studio_id,
          branch_ids: metadata.branch_ids || [],
          onboarding_step: effectiveStep,
        },
        studio: null,
        device: device.is_new ? { id: device.id, is_new_device: true } : undefined,
      };
    }

    // ── Workspace resolution via normalized RBAC ──
    const workspaces = await this.rbacService.getUserWorkspaces(user.id);

    if (workspaces.length > 1) {
      // Multiple studios — require workspace selection
      return {
        access_token: session?.access_token,
        refresh_token: session?.refresh_token,
        session_id: sessionId,
        requires_workspace_selection: true,
        workspaces: workspaces.map((w) => ({
          studio_id: w.studio_id,
          studio_name: w.studio_name,
          roles: w.roles.map((r) => r.role_name),
        })),
        user: {
          id: user.id,
          email: user.email,
          full_name: metadata.full_name,
        },
        device: device.is_new ? { id: device.id, is_new_device: true } : undefined,
      };
    }

    // Single studio or no RBAC rows yet — auto select
    const studioId = workspaces.length === 1
      ? workspaces[0].studio_id
      : metadata.studio_id;

    let role = metadata.role || 'owner';
    let branchIds = metadata.branch_ids || [];
    let roles: { role_name: string; branch_id: string | null; is_primary: boolean }[] = [];
    let permissionCodes: string[] = [];

    if (studioId && workspaces.length > 0) {
      const ws = workspaces[0];
      roles = ws.roles.map((r) => ({
        role_name: r.role_name,
        branch_id: r.branch_id,
        is_primary: r.is_primary,
      }));
      const primaryRole = ws.roles.find((r) => r.is_primary) || ws.roles[0];
      role = primaryRole.role_name;

      const hasGlobalAccess = ws.roles.some((r) => r.branch_id === null);
      if (!hasGlobalAccess) {
        branchIds = [...new Set(
          ws.roles.filter((r) => r.branch_id).map((r) => r.branch_id!),
        )];
      }

      permissionCodes = await this.rbacService.resolvePermissions(
        user.id, studioId,
      );
    }

    // Fully onboarded — fetch studio
    let studio = null;
    if (studioId) {
      try {
        studio = await this.pub.studio.findUnique({
          where: { id: studioId },
        });
      } catch (err) {
        this.logger.error(`Database error fetching studio: ${err.message}`);
      }
    }

    return {
      access_token: session?.access_token,
      refresh_token: session?.refresh_token,
      session_id: sessionId,
      user: {
        id: user.id,
        email: user.email,
        full_name: metadata.full_name,
        role,
        roles,
        studio_id: studioId,
        branch_ids: branchIds,
        permission_codes: permissionCodes,
      },
      studio,
      device: device.is_new ? { id: device.id, is_new_device: true } : undefined,
    };
  }

  /**
   * OAuth sign-in sync (Google / Apple).
   *
   * The frontend completes the provider handshake with Supabase directly and
   * lands on `/auth/callback` with a live Supabase session. It then posts those
   * session tokens here so the backend can run the SAME post-auth pipeline as
   * password login — crucially `syncIdentity`, without which the JWT guard
   * would reject every subsequent request ("User not found") for a brand-new
   * social user.
   *
   * Fresh social user → seeded with role=owner + onboarding_step=studio_info,
   *                     so they drop into the onboarding wizard.
   * Returning user    → reconcileOnboardingStep marks them complete and they
   *                     route straight to their dashboard (identity is linked by
   *                     verified email in Supabase, so a Google sign-in for an
   *                     existing email/password account resolves to the same user).
   */
  async oauthSync(
    accessToken: string,
    refreshToken: string,
    context?: LoginContext,
    deviceInfo?: LoginDto['device_info'],
  ) {
    // Verify the Supabase token server-side — never trust the client blindly.
    let authedUser;
    try {
      const { data, error } = await this.supabase.auth.getUser(accessToken);
      if (error || !data.user) {
        throw new UnauthorizedException('Invalid or expired sign-in session');
      }
      authedUser = data.user;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`OAuth token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Could not verify sign-in session');
    }

    // We provision the local identity by email; a provider that returns none
    // (e.g. an Apple private-relay opt-out) can't be onboarded here.
    if (!authedUser.email) {
      throw new BadRequestException(
        'Your sign-in provider did not share an email address, which is required to create your studio. Please use email and password.',
      );
    }

    // Collision guard: if this verified email already belongs to a DIFFERENT
    // local account, Supabase identity-linking is off and proceeding would hit
    // the unique-email constraint (500). Fail with an actionable message instead.
    // In the healthy linked case the ids match, so this never triggers.
    const emailOwner = await this.pub.userIdentity.findUnique({
      where: { email: authedUser.email },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== authedUser.id) {
      throw new ConflictException(
        'An account with this email already exists. Please sign in with your email and password.',
      );
    }

    const metadata = authedUser.user_metadata || {};

    // Seed first-login defaults for a brand-new social account. Supabase
    // populates email/full_name/avatar from the provider, but not our app-level
    // role/onboarding flags — without these the user has no role and no wizard.
    const patch: Record<string, any> = {};
    if (!metadata.role) patch.role = 'owner';
    if (!metadata.full_name && metadata.name) patch.full_name = metadata.name;
    // Only start the wizard for users with no studio yet; never overwrite an
    // existing step or bounce an already-onboarded owner.
    if (!metadata.onboarding_step && !metadata.studio_id) {
      patch.onboarding_step = 'studio_info';
    }
    if (Object.keys(patch).length > 0) {
      try {
        await this.supabase.auth.admin.updateUserById(authedUser.id, {
          user_metadata: { ...metadata, ...patch },
        });
        Object.assign(metadata, patch);
      } catch (err) {
        this.logger.warn(`Failed to seed OAuth user metadata: ${(err as Error).message}`);
      }
    }

    return this.buildAuthenticatedResponse(
      {
        id: authedUser.id,
        email: authedUser.email ?? null,
        user_metadata: metadata,
        email_confirmed_at:
          authedUser.email_confirmed_at ?? authedUser.confirmed_at ?? new Date().toISOString(),
      },
      { access_token: accessToken, refresh_token: refreshToken },
      authedUser.email ?? '',
      context,
      deviceInfo,
    );
  }

  async logout(accessToken: string) {
    // Revoke session in our tracking table
    await this.sessionService.revokeByToken(accessToken);
    // Sign out from Supabase
    await this.supabase.auth.admin.signOut(accessToken);
    return { success: true };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: dto.refresh_token,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Return full user/studio payload so frontend can update state
    const metadata = data.user?.user_metadata || {};
    // Heal a stale onboarding flag on token refresh as well, so the redirect
    // decision stays consistent across login, refresh, and getMe.
    if (data.user) {
      await this.reconcileOnboardingStep(data.user.id, metadata);
    }
    const studioId = metadata.studio_id;
    let studio = null;
    if (studioId) {
      try {
        studio = await this.pub.studio.findUnique({ where: { id: studioId } });
      } catch (err) {
        this.logger.error(`Error fetching studio on refresh: ${(err as Error).message}`);
      }
    }

    // Resolve roles/permissions
    let role = metadata.role || 'owner';
    let branchIds = metadata.branch_ids || [];
    let permissionCodes: string[] = [];

    if (studioId && data.user) {
      try {
        const userRoles = await this.rbacService.getUserRoles(data.user.id, studioId);
        if (userRoles.length > 0) {
          const primaryRole = userRoles.find((r) => r.is_primary) || userRoles[0];
          role = primaryRole.role_name;
          const hasGlobalAccess = userRoles.some((r) => r.branch_id === null);
          if (!hasGlobalAccess) {
            branchIds = [...new Set(userRoles.filter((r) => r.branch_id).map((r) => r.branch_id!))];
          }
          permissionCodes = await this.rbacService.resolvePermissions(data.user.id, studioId);
        }
      } catch (e) {
        this.logger.warn(`RBAC on refresh: ${e}`);
      }
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        full_name: metadata.full_name,
        role,
        studio_id: studioId,
        organization_id: metadata.organization_id,
        branch_ids: branchIds,
        permission_codes: permissionCodes,
        onboarding_step: metadata.onboarding_step,
      } : undefined,
      studio,
    };
  }

  async getMe(userId: string) {
    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    if (!userData?.user) throw new UnauthorizedException('User not found');

    const metadata = userData.user.user_metadata || {};
    // Heal a stale onboarding flag against real data so a profile refresh can't
    // re-trigger the onboarding redirect for an already-set-up gym.
    await this.reconcileOnboardingStep(userId, metadata);
    const studioId = metadata.studio_id;
    let studio = null;
    if (studioId) {
      try {
        studio = await this.pub.studio.findUnique({ where: { id: studioId } });
      } catch (err) {
        this.logger.error(`Error fetching studio: ${(err as Error).message}`);
      }
    }

    let role = metadata.role || 'owner';
    let branchIds = metadata.branch_ids || [];
    let permissionCodes: string[] = [];

    if (studioId) {
      try {
        const userRoles = await this.rbacService.getUserRoles(userId, studioId);
        if (userRoles.length > 0) {
          const primaryRole = userRoles.find((r) => r.is_primary) || userRoles[0];
          role = primaryRole.role_name;
          const hasGlobalAccess = userRoles.some((r) => r.branch_id === null);
          if (!hasGlobalAccess) {
            branchIds = [...new Set(userRoles.filter((r) => r.branch_id).map((r) => r.branch_id!))];
          }
          permissionCodes = await this.rbacService.resolvePermissions(userId, studioId);
        }
      } catch (e) {
        this.logger.warn(`RBAC in getMe: ${e}`);
      }
    }

    // Resolve current subscription lifecycle context — single source of truth
    // for frontend banners, modals, and write-guards.
    let subscription = null as
      | Awaited<ReturnType<SubscriptionPolicyService['getContext']>>
      | null;
    if (studioId) {
      try {
        subscription = await this.subscriptionPolicy.getContext(studioId);
      } catch (err) {
        this.logger.warn(`Subscription context lookup failed: ${(err as Error).message}`);
      }
    }

    return {
      user: {
        id: userId,
        email: userData.user.email,
        full_name: metadata.full_name,
        role,
        studio_id: studioId,
        organization_id: metadata.organization_id,
        branch_ids: branchIds,
        permission_codes: permissionCodes,
        onboarding_step: metadata.onboarding_step,
      },
      studio,
      subscription,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    await this.supabase.auth.resetPasswordForEmail(dto.email, {
      redirectTo: `${this.configService.get('CORS_ORIGINS', 'http://localhost:3000')}/reset-password`,
    });
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Verify the Supabase recovery session SERVER-SIDE. The frontend exchanges
    // the emailed recovery code/hash for a session and posts its access_token
    // here; we re-validate that token with Supabase and derive the user id FROM
    // the verified token — never from client-supplied input. This closes the
    // account-takeover hole where any caller could pass an arbitrary user id to
    // `updateUserById` and set that account's password without holding the
    // recovery link (the endpoint is public/unauthenticated).
    let userId: string;
    try {
      const { data, error } = await this.supabase.auth.getUser(dto.access_token);
      if (error || !data.user) {
        throw new BadRequestException(
          'Invalid or expired reset link. Please request a new one.',
        );
      }
      userId = data.user.id;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`resetPassword token verification failed: ${(err as Error).message}`);
      throw new BadRequestException(
        'Invalid or expired reset link. Please request a new one.',
      );
    }

    const { error } = await this.supabase.auth.admin.updateUserById(userId, {
      password: dto.new_password,
    });

    if (error) {
      throw new BadRequestException('Failed to reset password');
    }

    return { success: true };
  }

  async onboarding(dto: OnboardingDto) {
    const slug = dto.studio_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = await this.pub.studio.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('A studio with this name already exists');
    }

    // Create Supabase user
    const { data: authData, error: authError } =
      await this.supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          full_name: dto.full_name,
          role: 'owner',
        },
      });

    if (authError || !authData.user) {
      throw new ConflictException(
        authError?.message || 'Failed to create user',
      );
    }

    // Create studio
    const studioReferralCode = await this.generateUniqueReferralCode();
    const studio = await this.pub.studio.create({
      data: {
        name: dto.studio_name,
        slug,
        schema_name: `studio_${authData.user.id.replace(/-/g, '_')}`,
        owner_user_id: authData.user.id,
        timezone: dto.timezone || DEFAULT_TIMEZONE,
        currency: dto.currency || DEFAULT_CURRENCY,
        referral_code: studioReferralCode,
      },
    });

    // Create studio schema FIRST — must exist before any tenant data
    try {
      if (!/^studio_[0-9a-f_]+$/i.test(studio.schema_name)) {
        throw new InternalServerErrorException('Invalid schema name');
      }
      await this.prisma.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS "${studio.schema_name}"`,
      );
      await this.cloneTenantSchema(studio.schema_name);
    } catch (error) {
      this.logger.error(`Failed to create schema ${studio.schema_name}`, error);
      throw new InternalServerErrorException('Failed to initialize studio environment');
    }

    // Create organization + branch inside the tenant schema context
    // This ensures the Prisma $use middleware sets the correct search_path
    const { branch, organizationId } = await this.runInTenantContext(studio.schema_name, async () => {
      // Create organization for this studio
      const org = await this.prisma.organization.create({
        data: {
          gym_id: studio.id,
          name: dto.studio_name,
          slug,
          country: 'IN',
          timezone: dto.timezone || DEFAULT_TIMEZONE,
          currency: dto.currency || DEFAULT_CURRENCY,
          status: 'active',
        },
      });

      // Create first branch linked to organization
      const b = await this.prisma.branch.create({
        data: {
          gym_id: studio.id,
          name: dto.branch_name,
          address: dto.branch_address,
          city: dto.branch_city,
          phone: dto.branch_phone,
          organization_id: org.id,
          is_active: true,
        },
      });

      return { branch: b, organizationId: org.id };
    }, studio.id);

    // Update user metadata with studio_id, org_id, and branch_ids
    await this.supabase.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        full_name: dto.full_name,
        role: 'owner',
        studio_id: studio.id,
        organization_id: organizationId,
        branch_ids: [branch.id],
      },
    });

    // ── Assign owner role via normalized RBAC ──
    await this.rbacService.assignRole({
      user_id: authData.user.id,
      studio_id: studio.id,
      role_name: 'owner',
      branch_id: undefined, // null = all branches
      is_primary: true,
    });

    // Seed enterprise roles for this studio (runs in tenant context)
    try {
      await this.runInTenantContext(studio.schema_name, () =>
        this.rbacSeedService.seedStudioRoles(),
      studio.id);
    } catch (err) {
      this.logger.warn(`Failed to seed studio roles: ${err.message}`);
    }

    // Sign in
    const { data: signInData } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    return {
      access_token: signInData?.session?.access_token,
      refresh_token: signInData?.session?.refresh_token,
      user: {
        id: authData.user.id,
        email: dto.email,
        full_name: dto.full_name,
        role: 'owner',
        roles: [{ role_name: 'owner', branch_id: null, is_primary: true }],
        studio_id: studio.id,
        branch_ids: [branch.id],
      },
      studio,
    };
  }

  // ── Workspace Selection (multi-studio users) ──

  async selectWorkspace(userId: string, studioId: string, branchId?: string) {
    // Verify user has a role in this studio
    const userRoles = await this.rbacService.getUserRoles(userId, studioId);
    if (userRoles.length === 0) {
      throw new UnauthorizedException('You do not have access to this studio');
    }

    const primaryRole = userRoles.find((r) => r.is_primary) || userRoles[0];
    const role = primaryRole.role_name;

    // Resolve branch access
    const hasGlobalAccess = userRoles.some((r) => r.branch_id === null);
    let branchIds: string[] = [];
    if (!hasGlobalAccess) {
      branchIds = [...new Set(
        userRoles.filter((r) => r.branch_id).map((r) => r.branch_id!),
      )];
    }

    // If branchId specified, verify access
    if (branchId && !hasGlobalAccess && !branchIds.includes(branchId)) {
      throw new UnauthorizedException('You do not have access to this branch');
    }

    // Resolve permissions
    const permissionCodes = await this.rbacService.resolvePermissions(
      userId, studioId, branchId,
    );

    // Fetch studio
    const studio = await this.pub.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new BadRequestException('Studio not found');
    }

    return {
      user: {
        role,
        roles: userRoles.map((r) => ({
          role_name: r.role_name,
          branch_id: r.branch_id,
          is_primary: r.is_primary,
        })),
        studio_id: studioId,
        branch_id: branchId,
        branch_ids: branchIds,
        permission_codes: permissionCodes,
      },
      studio,
    };
  }

  // ── Registration (stores pending; Supabase account created only after email verified) ──

  async register(dto: RegisterDto) {
    // Check if email already has a completed account in Supabase Auth
    const { data: listData } = await this.supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = (listData?.users as unknown as Array<{ id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> }>)
      ?.find((u) => u.email === dto.email);
    if (existingAuthUser) {
      const meta = existingAuthUser.user_metadata || {};
      // Re-registration of an incomplete account (no studio_id): only fast-path
      // an account whose email is ALREADY verified in Supabase. This is not a
      // bypass — the email was confirmed when the account was first created; we
      // never issue a session for an unverified address. An unconfirmed account
      // falls through to the normal pending-registration + verification flow.
      if (!meta.studio_id && existingAuthUser.email_confirmed_at) {
        await this.supabase.auth.admin.updateUserById(existingAuthUser.id, {
          password: dto.password,
          user_metadata: {
            full_name: dto.full_name,
            phone: dto.phone,
            role: 'owner',
            onboarding_step: 'studio_info',
          },
        });

        // Sync identity
        await this.identityService.syncIdentity({
          id: existingAuthUser.id,
          email: dto.email,
          full_name: dto.full_name,
          phone: dto.phone ?? undefined,
          email_verified: true,
        });

        // Sign in and return tokens — skip email verification since account already confirmed
        const { data: signInData } = await this.supabase.auth.signInWithPassword({
          email: dto.email,
          password: dto.password,
        });

        return {
          success: true,
          email: dto.email,
          // The account's email is already verified (guarded above) — the client
          // can proceed straight to onboarding rather than the "check your email"
          // screen. This is not an unverified login.
          already_verified: true,
          access_token: signInData?.session?.access_token,
          refresh_token: signInData?.session?.refresh_token,
          user: {
            id: existingAuthUser.id,
            email: dto.email,
            full_name: dto.full_name,
            role: 'owner',
            onboarding_step: 'studio_info',
          },
        };
      }

      throw new ConflictException('An account with this email already exists. Please sign in instead.');
    }

    // Remove any previous pending registration for this email (allows re-registration)
    await this.pub.pendingRegistration.deleteMany({ where: { email: dto.email } });

    // Encrypt password for secure temporary storage (AES-256-GCM)
    const encryptedPassword = this.encryptPassword(dto.password);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.pub.pendingRegistration.create({
      data: {
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone,
        encrypted_password: encryptedPassword,
        token,
        expires_at: expiresAt,
      },
    });

    const frontendUrl = this.getAppFrontendUrl();
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    // Dev convenience only — never log verification links in production.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`📧 Verification link (dev) for ${dto.email}: ${verificationUrl}`);
    }
    const emailSent = await this.sendVerificationEmail(dto.email, dto.full_name, verificationUrl);
    if (!emailSent) {
      // Do NOT leak the verification link to the client. Surface a clear error so
      // the user can retry; the link reaches them only via real email delivery.
      this.logger.error(`Verification email could not be delivered to ${dto.email}`);
    }

    // The token/link is intentionally never returned to the client.
    return { success: true, email: dto.email };
  }

  // ── Email Verification (creates Supabase account after token validated) ──────

  async verifyEmail(dto: VerifyEmailDto) {
    const pending = await this.pub.pendingRegistration.findUnique({
      where: { token: dto.token },
    });

    if (!pending) {
      throw new BadRequestException(
        'Invalid or expired verification link. Please register again.',
      );
    }

    if (pending.expires_at < new Date()) {
      await this.pub.pendingRegistration.delete({ where: { token: dto.token } });
      throw new BadRequestException(
        'Verification link has expired. Please register again.',
      );
    }

    // Decrypt password and create the real Supabase account
    const password = this.decryptPassword(pending.encrypted_password);

    let userId: string;
    let isExistingUser = false;

    const { data: authData, error: authError } =
      await this.supabase.auth.admin.createUser({
        email: pending.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: pending.full_name,
          phone: pending.phone,
          role: 'owner',
          onboarding_step: 'studio_info',
        },
      });

    if (authError || !authData.user) {
      this.logger.warn(`createUser failed for ${pending.email}: ${authError?.message}`);
      // If account already exists (e.g. re-registration after DB truncation),
      // update password and sign in instead of failing
      if (authError?.message?.toLowerCase().includes('already') ||
          authError?.message?.toLowerCase().includes('duplicate') ||
          authError?.message?.toLowerCase().includes('exists')) {
        // Use admin API to find the existing user by email
        let existingId: string | null = null;

        const { data: listData, error: listError } = await this.supabase.auth.admin.listUsers({ perPage: 1000 });
        if (listError) {
          this.logger.error(`listUsers failed: ${listError.message}`);
        }
        const found = (listData?.users as unknown as Array<{ id: string; email?: string }>)
          ?.find((u) => u.email === pending.email);
        existingId = found?.id ?? null;

        if (!existingId) {
          this.logger.error(`Could not find existing Supabase Auth user for ${pending.email}`);
          throw new ConflictException('An account with this email already exists. Please sign in.');
        }

        this.logger.log(`Found existing auth user ${existingId} for ${pending.email}, updating...`);
        // Fetch the existing user's metadata
        const { data: existingUser } = await this.supabase.auth.admin.getUserById(existingId);
        const existingMeta = existingUser?.user?.user_metadata || {};
        // Update password to the newly registered one and reset metadata
        await this.supabase.auth.admin.updateUserById(existingId, {
          password,
          email_confirm: true,
          user_metadata: {
            ...existingMeta,
            full_name: pending.full_name,
            phone: pending.phone,
            onboarding_step: 'studio_info',
          },
        });
        userId = existingId;
        isExistingUser = true;
      } else {
        throw new InternalServerErrorException(
          authError?.message || 'Failed to create account',
        );
      }
    } else {
      userId = authData.user.id;
    }

    // Delete the pending record — account is now real
    await this.pub.pendingRegistration.delete({ where: { token: dto.token } });

    // Sync user to local identity table so JWT guard can find them
    await this.identityService.syncIdentity({
      id: userId,
      email: pending.email,
      full_name: pending.full_name,
      phone: pending.phone ?? undefined,
      email_verified: true,
    });

    // Sign in to return session tokens to the frontend
    try {
      const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
        email: pending.email,
        password,
      });

      if (signInError || !signInData?.session) {
        this.logger.error(`signInWithPassword failed for ${pending.email}: ${signInError?.message ?? 'no session returned'}`);
        throw new InternalServerErrorException('Account created but sign-in failed. Please try logging in manually.');
      }

      // Determine current onboarding step
      const metadata = isExistingUser
        ? (await this.supabase.auth.admin.getUserById(userId)).data?.user?.user_metadata
        : authData?.user?.user_metadata;
      const onboardingStep = metadata?.onboarding_step || 'studio_info';

      return {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        user: {
          id: userId,
          email: pending.email,
          full_name: pending.full_name,
          role: 'owner',
          studio_id: undefined as string | undefined,
          branch_ids: [] as string[],
          onboarding_step: onboardingStep,
        },
        studio: null,
      };
    } catch (err) {
      this.logger.error(`verifyEmail post-creation failed for ${pending.email}: ${err?.message ?? err}`, err?.stack);
      if (err instanceof InternalServerErrorException) throw err;
      throw new InternalServerErrorException(
        `Account created but post-setup failed: ${err?.message ?? 'unknown error'}. Please try logging in manually.`,
      );
    }
  }

  // ── Resend Verification (public — takes email in body, no JWT required) ──────

  async resendVerification(email: string) {
    const pending = await this.pub.pendingRegistration.findFirst({
      where: { email },
    });

    if (!pending) {
      throw new BadRequestException(
        'No pending registration found for this email. Please register again.',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.pub.pendingRegistration.update({
      where: { id: pending.id },
      data: { token, expires_at: expiresAt },
    });

    const frontendUrl = this.getAppFrontendUrl();
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`📧 Resent verification (dev) for ${email}: ${verificationUrl}`);
    }
    const emailSent = await this.sendVerificationEmail(email, pending.full_name, verificationUrl);
    if (!emailSent) {
      this.logger.error(`Resent verification email could not be delivered to ${email}`);
    }

    // The token/link is intentionally never returned to the client.
    return { sent: true };
  }

  // ── Send Verification Email ──────────────────────────────

  /**
   * Canonical base URL of the gym/studio web app — used to build user-facing
   * links (email verification, password reset). Prefers the explicit
   * FRONTEND_URL; falls back to the first CORS origin for backwards compat.
   *
   * NOTE: CORS_ORIGINS[0] is NOT reliable as the app URL — in dev the SaaS
   * Control Center and the gym app run on different ports and the first
   * allowed origin may be the SCC (which has no /verify-email route → 404).
   * Set FRONTEND_URL to the gym app's URL.
   */
  private getAppFrontendUrl(): string {
    const explicit = this.configService.get<string>('FRONTEND_URL');
    if (explicit && explicit.trim()) {
      return explicit.trim().replace(/\/+$/, '');
    }
    return this.configService
      .get('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
  }

  private async sendVerificationEmail(
    email: string,
    name: string,
    verificationUrl: string,
  ): Promise<boolean> {
    // Centralized branded delivery. "Sent" = delivered inline OR accepted by the
    // queue; either way the user will get the email and no link should be leaked.
    const result = await this.emailService.send({
      to: email,
      templateId: EmailTemplateId.VerifyEmail,
      data: { name, verificationUrl, expiresInHours: 24 },
      dedupeKey: `verify:${email}`,
    });
    return result.delivered || result.queued;
  }

  // ── AES-256-GCM Password Encryption (for temporary pending_registrations storage) ──

  private static readonly ENCRYPTION_SALT = 'musclex-pending-reg-v1';

  private deriveEncryptionKey(): Buffer {
    const secret = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', '');
    if (!secret) throw new InternalServerErrorException('Encryption key not configured');
    return pbkdf2Sync(secret, AuthService.ENCRYPTION_SALT, 100000, 32, 'sha256');
  }

  private encryptPassword(password: string): string {
    const key = this.deriveEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decryptPassword(encryptedBase64: string): string {
    const key = this.deriveEncryptionKey();
    const data = Buffer.from(encryptedBase64, 'base64');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // ── Available Plans (public, DB-backed) ──────────────────

  async getPlans() {
    return fetchAvailablePlans(this.prisma, 'regular');
  }

  // ── Plan Selection (delegates to onboarding step 7) ───────────────────

  async selectPlan(userId: string, planId: string) {
    return this.onboardingSelectSubscription(userId, planId);
  }

  // ── Studio Setup (Step 3 — creates studio + schema) ─────────────────

  async setupStudio(userId: string, dto: SetupStudioDto) {
    const { data: userData, error: userError } =
      await this.supabase.auth.admin.getUserById(userId);
    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }
    const metadata = userData?.user?.user_metadata || {};
    const email = userData?.user?.email;

    const slug = dto.studio_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existingStudio = metadata.studio_id
      ? await this.pub.studio.findUnique({ where: { id: metadata.studio_id } })
      : await this.pub.studio.findFirst({ where: { owner_user_id: userId } });

    const existing = await this.pub.studio.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== existingStudio?.id) {
      throw new ConflictException(
        'A studio with this name already exists. Please choose a different name.',
      );
    }

    const now = new Date();
    const schemaName = `studio_${userId.replace(/-/g, '_')}`;

    let studio;
    let branch = metadata.branch_ids?.[0]
      ? await this.prisma.branch.findUnique({ where: { id: metadata.branch_ids[0] } })
      : null;

    if (existingStudio) {
      studio = await this.pub.studio.update({
        where: { id: existingStudio.id },
        data: {
          name: dto.studio_name,
          slug,
          business_type: dto.business_type,
          account_type: 'gym',
          phone: dto.phone,
          email: dto.email || email,
          country: dto.country,
          website: dto.website,
          logo_url: dto.logo_url,
          timezone: dto.timezone || existingStudio.timezone || DEFAULT_TIMEZONE,
          currency: dto.currency || existingStudio.currency || DEFAULT_CURRENCY,
          email_verified: true,
        },
      });
    } else {
      // Generate a unique 6-char referral code for this studio
      const referralCode = await this.generateUniqueReferralCode();

      studio = await this.pub.studio.create({
        data: {
          name: dto.studio_name,
          slug,
          schema_name: schemaName,
          owner_user_id: userId,
          business_type: dto.business_type,
          account_type: 'gym',
          phone: dto.phone,
          email: dto.email || email,
          country: dto.country,
          website: dto.website,
          logo_url: dto.logo_url,
          timezone: dto.timezone || DEFAULT_TIMEZONE,
          currency: dto.currency || DEFAULT_CURRENCY,
          subscription_plan: DEFAULT_PLAN,
          subscription_status: 'trial',
          subscription_start: now,
          email_verified: true,
          referral_code: referralCode,
        },
      });

      try {
        await this.prisma.$executeRawUnsafe(
          `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
        );
        await this.cloneTenantSchema(schemaName);
      } catch (error) {
        this.logger.error(`Failed to create schema ${schemaName}`, error);
        throw new InternalServerErrorException('Failed to initialize studio environment');
      }
    }

    // Create Organization record in the tenant schema (required for staff/member/class relationships)
    // Use runInTenantContext to set AsyncLocalStorage so Prisma $use middleware works correctly
    let organizationId = metadata.organization_id as string | undefined;
    if (!organizationId) {
      try {
        const orgSlug = studio.slug || schemaName;
        const org = await this.runInTenantContext(schemaName, () =>
          this.prisma.organization.create({
            data: {
              gym_id: studio.id,
              name: studio.name,
              slug: orgSlug,
              country: dto.country,
              timezone: studio.timezone || DEFAULT_TIMEZONE,
              currency: studio.currency || DEFAULT_CURRENCY,
              status: 'active',
            },
          }),
        studio.id);
        organizationId = org.id;
      } catch (e) {
        this.logger.warn(`Organization creation in tenant schema: ${e}`);
      }
    }

    // Set up user metadata — advance to next onboarding step
    const nextOnboardingStep = 'setup_branches';

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        role: 'owner',
        studio_id: studio.id,
        organization_id: organizationId,
        branch_ids: [],
        account_type: 'gym',
        onboarding_step: nextOnboardingStep,
      },
    });

    // Sync studio to SaaS Control Center.
    // Pass the live-computed lifecycle_status so the SCC dashboard never shows
    // a gym as "ACTIVE" while it's actually expired/locked. A brand-new studio
    // has no lifecycle_status yet, so we fall back to the legacy column.
    await this.sccSync.upsertTenant({
      id: studio.id,
      name: studio.name,
      slug: studio.slug,
      email: studio.email || email,
      phone: studio.phone,
      logo_url: studio.logo_url,
      account_type: (studio as any).account_type || 'gym',
      subscription_plan: studio.subscription_plan,
      lifecycle_status: studio.lifecycle_status ?? undefined,
      subscription_status: studio.subscription_status,
      trial_ends_at: studio.trial_ends_at,
      owner_full_name: metadata.full_name as string | undefined,
    });

    // Seed RBAC roles for the studio (inside tenant context)
    try {
      await this.runInTenantContext(schemaName, () =>
        this.rbacSeedService.seedStudioRoles(),
      studio.id);
    } catch (e) {
      this.logger.warn(`RBAC seed partially failed: ${e}`);
    }

    // Assign owner role
    try {
      await this.pub.userRole.upsert({
        where: { user_id_studio_id_branch_id: { user_id: userId, studio_id: studio.id, branch_id: null as any } },
        create: { user_id: userId, studio_id: studio.id, role_name: 'owner', is_primary: true },
        update: { role_name: 'owner' },
      });
    } catch (e) {
      this.logger.warn(`Owner role assignment: ${e}`);
    }

    return {
      user: {
        id: userId,
        email,
        full_name: metadata.full_name,
        role: 'owner',
        studio_id: studio.id,
        organization_id: organizationId,
        branch_ids: [],
        account_type: 'gym',
        onboarding_step: nextOnboardingStep,
      },
      studio: {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        timezone: studio.timezone,
        currency: studio.currency,
        logo_url: studio.logo_url,
      },
    };
  }

  // ── Onboarding Step 4: Branches ──────────────────────────────────────

  async onboardingBranches(userId: string, dto: OnboardingBranchesDto) {
    this.logger.log(`onboardingBranches called for user ${userId}, branches: ${dto.branches?.length}`);
    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};
    const studioId = metadata.studio_id;
    const organizationId = metadata.organization_id as string | undefined;
    this.logger.log(`onboardingBranches: studioId=${studioId}, organizationId=${organizationId}`);

    if (!studioId) {
      throw new BadRequestException('Studio not yet created. Complete studio setup first.');
    }

    if (!dto.branches || dto.branches.length === 0) {
      throw new BadRequestException('At least one branch is required to continue.');
    }

    // Look up the actual schema_name from the Studio record
    const studioRows = await this.prisma.$queryRawUnsafe<Array<{ schema_name: string }>>(
      `SELECT schema_name FROM public.studios WHERE id = $1::uuid LIMIT 1`,
      studioId,
    );
    const schemaName = studioRows?.[0]?.schema_name;
    if (!schemaName || !/^studio_[0-9a-f_]+$/i.test(schemaName)) {
      throw new BadRequestException('Studio schema not found');
    }

    const createdBranches: string[] = [];

    // Verify organization_id actually exists in the tenant schema before using it (FK constraint)
    let validOrgId: string | undefined;
    if (organizationId) {
      const orgCheck = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "studio_template", public`);
        return tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM organizations WHERE id = $1::uuid LIMIT 1`,
          organizationId,
        );
      });
      if (orgCheck.length > 0) {
        validOrgId = organizationId;
      } else {
        // Organization record missing — create it now
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL search_path TO "studio_template", public`);
            await tx.$queryRawUnsafe(
              `INSERT INTO organizations (id, gym_id, name, slug, status)
               VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
              organizationId,
              studioId,
              metadata.full_name || 'My Gym',
              schemaName,
              'active',
            );
          });
          validOrgId = organizationId;
        } catch (e) {
          this.logger.warn(`Could not create missing organization: ${e}`);
        }
      }
    }

    for (const b of dto.branches) {
      try {
        const columns: string[] = ['gym_id', 'name', 'address', 'city', 'state', 'country', 'postal_code', 'phone', 'is_active', 'status'];
        const casts: string[] = ['::uuid', '', '', '', '', '', '', '', '', ''];
        const values: unknown[] = [studioId, b.name, b.address || null, b.city || null, b.state || null, b.country || null, b.postal_code || null, b.phone || null, true, 'active'];

        // Geo-coordinates (member-app gym finder). Optional — only sent when the
        // owner pinned a location during onboarding.
        if (typeof b.latitude === 'number' && typeof b.longitude === 'number') {
          columns.push('latitude', 'longitude');
          casts.push('', '');
          values.push(b.latitude, b.longitude);
        }

        if (validOrgId) {
          columns.push('organization_id');
          casts.push('::uuid');
          values.push(validOrgId);
        }

        const placeholders = values.map((_, i) => `$${i + 1}${casts[i]}`).join(', ');
        const rows = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO "studio_template", public`);
          return tx.$queryRawUnsafe<Array<{ id: string }>>(
            `INSERT INTO branches (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
            ...values,
          );
        });
        if (rows[0]?.id) createdBranches.push(rows[0].id);
      } catch (err) {
        this.logger.error(`onboardingBranches INSERT failed: ${err?.message ?? err}`, err?.stack);
        throw err;
      }
    }

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        branch_ids: createdBranches,
        onboarding_step: 'setup_plans',
      },
    });

    return { branch_ids: createdBranches, onboarding_step: 'setup_plans' };
  }

  // ── Onboarding Step 5: Membership Plans ──────────────────────────────

  async onboardingMemberships(userId: string, dto: OnboardingMembershipsDto) {
    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};
    const studioId = metadata.studio_id;
    const branchIds: string[] = metadata.branch_ids || [];
    const organizationId = metadata.organization_id as string | undefined;

    if (!studioId) {
      throw new BadRequestException('Studio not yet created.');
    }

    // Look up the actual schema_name from the Studio record
    const studioRows = await this.prisma.$queryRawUnsafe<Array<{ schema_name: string }>>(
      `SELECT schema_name FROM public.studios WHERE id = $1::uuid LIMIT 1`,
      studioId,
    );
    const schemaName = studioRows?.[0]?.schema_name;
    if (!schemaName || !/^studio_[0-9a-f_]+$/i.test(schemaName)) {
      throw new BadRequestException('Studio schema not found');
    }

    const createdPlans: string[] = [];

    // Verify organization_id exists in tenant schema (FK constraint)
    let validOrgId: string | undefined;
    if (organizationId) {
      const orgCheck = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "studio_template", public`);
        return tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM organizations WHERE id = $1::uuid LIMIT 1`,
          organizationId,
        );
      });
      validOrgId = orgCheck.length > 0 ? organizationId : undefined;
    }

    if (dto.plans && dto.plans.length > 0) {
      for (const p of dto.plans) {
        const rows = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO "studio_template", public`);

          const columns: string[] = ['gym_id', 'name', 'description', 'plan_type', 'duration_days', 'price', 'currency', 'is_active', 'auto_renew_enabled', 'grace_period_days', 'multi_branch_access'];
          const casts: string[] = ['::uuid', '', '', '', '', '', '', '', '', '', ''];
          const values: unknown[] = [studioId, p.name, p.description || null, p.plan_type, p.duration_days || null, p.price, p.currency || DEFAULT_CURRENCY, true, false, 0, false];

          if (branchIds[0]) {
            columns.push('branch_id');
            casts.push('::uuid');
            values.push(branchIds[0]);
          }
          if (validOrgId) {
            columns.push('organization_id');
            casts.push('::uuid');
            values.push(validOrgId);
          }

          const placeholders = values.map((_, i) => `$${i + 1}${casts[i]}`).join(', ');
          return tx.$queryRawUnsafe<Array<{ id: string }>>(
            `INSERT INTO membership_plans (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
            ...values,
          );
        });
        if (rows[0]?.id) createdPlans.push(rows[0].id);
      }
    }

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, onboarding_step: 'setup_staff' },
    });

    return { plan_ids: createdPlans, onboarding_step: 'setup_staff' };
  }

  // ── Onboarding Step 6: Staff (Optional) ──────────────────────────────

  async onboardingStaff(userId: string, dto: OnboardingStaffListDto) {
    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};
    const studioId = metadata.studio_id;
    const branchIds: string[] = metadata.branch_ids || [];
    const organizationId = metadata.organization_id as string | undefined;

    if (!studioId) {
      throw new BadRequestException('Studio not yet created.');
    }

    // Look up the actual schema_name from the Studio record (consistent with branches/memberships)
    const studioRows = await this.prisma.$queryRawUnsafe<Array<{ schema_name: string }>>(
      `SELECT schema_name FROM public.studios WHERE id = $1::uuid LIMIT 1`,
      studioId,
    );
    const schemaName = studioRows?.[0]?.schema_name;
    if (!schemaName || !/^studio_[0-9a-f_]+$/i.test(schemaName)) {
      throw new BadRequestException('Studio schema not found');
    }

    const createdStaff: string[] = [];

    await this.runInTenantContext(schemaName, async () => {
      for (const s of dto.staff) {
        const staff = await this.prisma.staff.create({
          data: {
            gym_id: studioId,
            full_name: s.full_name,
            role: s.role,
            email: s.email || undefined,
            phone: s.phone || '',
            branch_id: branchIds[0] || undefined,
            organization_id: organizationId || undefined,
            status: 'active',
          },
        });
        createdStaff.push(staff.id);
      }
    }, studioId);

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, onboarding_step: 'select_subscription' },
    });

    return { staff_ids: createdStaff, onboarding_step: 'select_subscription' };
  }

  // ── Onboarding Step 7: Select Subscription ───────────────────────────

  async onboardingSelectSubscription(userId: string, planId: string, billingCycle: 'monthly' | 'annual' = 'monthly') {
    if (!PLAN_CONFIGS[planId]) {
      throw new BadRequestException(`Invalid plan: ${planId}`);
    }

    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};
    const studioId = metadata.studio_id;

    if (!studioId) {
      throw new BadRequestException('Studio not yet created.');
    }

    // Validate plan is a regular gym plan
    const planConfig = PLAN_CONFIGS[planId];
    if (!planConfig || planConfig.plan_type !== 'regular') {
      throw new BadRequestException(
        `Plan "${planId}" is not available.`,
      );
    }

    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setDate(nextBilling.getDate() + (billingCycle === 'annual' ? 365 : 30));

    await this.pub.studio.update({
      where: { id: studioId },
      data: {
        subscription_plan: planId,
        subscription_status: planId === DEFAULT_PLAN ? 'active' : 'trial',
        billing_cycle: billingCycle,
        subscription_start: now,
        trial_ends_at: planId !== DEFAULT_PLAN ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
        next_billing_date: planId !== DEFAULT_PLAN ? nextBilling : null,
      },
    });

    // Free plan → complete onboarding immediately
    // Paid plan → go to payment step first
    const nextStep = planId === DEFAULT_PLAN ? 'complete' : 'payment';

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, selected_plan: planId, billing_cycle: billingCycle, onboarding_step: nextStep },
    });

    // Sync plan selection to SCC (trial status — confirmed active after payment)
    const studioRow = await this.pub.studio.findUnique({ where: { id: studioId }, select: { slug: true } });
    if (studioRow) {
      const trialEndsAt = planId !== DEFAULT_PLAN ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null;
      await this.sccSync.syncPlanChange(studioRow.slug, planId === DEFAULT_PLAN ? 'active' : 'trial', trialEndsAt, planId);
    }

    // ── Referral reward: deliberately NOT emitted here ──────────────
    // Selecting a paid plan is only an INTENT to pay — no money has moved.
    // Emitting SUBSCRIPTION_ACTIVATED here let a referred gym click a plan,
    // never pay, and still hand the referrer a +days extension (fraud hole).
    // The reward is now emitted from onboardingRecordPayment AFTER a verified
    // payment is recorded. See that method.

    return { plan: planId, billing_cycle: billingCycle, onboarding_step: nextStep };
  }

  // ── Onboarding Step 8: Record Payment (paid plans only) ──────────

  async onboardingRecordPayment(userId: string, dto: OnboardingPaymentDto) {
    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};
    const studioId = metadata.studio_id as string;
    if (!studioId) throw new BadRequestException('Studio not yet created.');

    const studio = await this.pub.studio.findUnique({ where: { id: studioId } });
    if (!studio) throw new BadRequestException('Studio not found.');

    const currency = dto.currency || studio.currency || DEFAULT_CURRENCY;
    const now = new Date();

    // ── Verify the Razorpay payment when gateway proof is supplied ──
    // The frontend runs Razorpay Checkout (via subscription/create-order) and
    // posts the handshake here. We verify the signature and re-fetch the order
    // so the amount + ownership are authoritative (never trust the client).
    // When no gateway proof is present we fall back to the recorded amount
    // (legacy/manual path) so older clients keep working.
    let paidAmount = dto.amount;
    let paymentReference: string | undefined;
    let paymentMethod = 'card';
    if (dto.gateway_order_id && dto.gateway_payment_id && dto.signature) {
      const ok = this.razorpay.verifyCheckoutSignature(
        dto.gateway_order_id,
        dto.gateway_payment_id,
        dto.signature,
      );
      if (!ok) throw new ForbiddenException('Invalid payment signature');
      const order = await this.razorpay.getOrder(dto.gateway_order_id);
      if (order.notes?.studio_id && order.notes.studio_id !== studioId) {
        throw new ForbiddenException('Order does not belong to this studio');
      }
      if (order.status !== 'paid') {
        throw new BadRequestException(`Order not paid (status: ${order.status})`);
      }
      paidAmount = order.amount / 100; // paise → major unit
      paymentReference = dto.gateway_payment_id;
      paymentMethod = 'razorpay';
    }

    // First real payment anchors the billing period from NOW — not from the
    // trial-window date set during plan selection. recordRenewal() uses strict
    // continuity (period_start = prior next_billing_date), so we reset
    // next_billing_date to `now` first; the renewal then grants a full
    // 30-/365-day period and persists next_billing_date, subscription_start,
    // lifecycle_status, the invoice, and the ledger events in one transaction.
    // Also clear trial_ends_at: the user just paid, so the trial is over even
    // though its 14-day window may still be in the future.
    // Persist the billing information collected on the payment step so the
    // GST tax invoice generated by recordRenewal() carries the correct
    // bill-to details. GSTIN is optional; when present we also derive the
    // 2-digit GST state code from its first two characters.
    await this.pub.studio.update({
      where: { id: studioId },
      data: {
        next_billing_date: now,
        trial_ends_at: null,
        billing_name: dto.billing_name,
        billing_email: dto.billing_email,
        billing_address: dto.billing_address,
        ...(dto.gstin
          ? { gstin: dto.gstin, gst_state_code: dto.gstin.slice(0, 2) }
          : {}),
      },
    });

    const renewal = await this.subscriptionPolicy.recordRenewal({
      studio_id: studioId,
      actor_id: userId,
      actor_type: 'user',
      amount: paidAmount,
      currency,
      now,
      // Honor the plan the user paid for during onboarding.
      new_plan: dto.plan_id || studio.subscription_plan,
      new_billing_cycle: studio.billing_cycle,
      // Idempotency key — a replayed onboarding payment (double-submit) won't
      // grant a second billing period or duplicate invoice.
      payment_reference: paymentReference,
      metadata: {
        source: 'onboarding',
        payment_method: paymentMethod,
        ...(paymentReference ? { payment_reference: paymentReference } : {}),
        ...(dto.card_brand ? { card_brand: dto.card_brand } : {}),
        ...(dto.card_last4 ? { card_last4: dto.card_last4 } : {}),
      },
    });

    // Complete onboarding
    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, onboarding_step: 'complete' },
    });

    // Sync active status to SCC. The payment itself is mirrored centrally by
    // SubscriptionPolicyService.recordRenewal() (called above), so we no longer
    // upsert the payment here — that kept onboarding in sync but left renewals
    // and plan-change payments invisible in the SCC /billing page.
    await this.sccSync.syncPlanChange(studio.slug, 'active', null, dto.plan_id);

    // ── Emit referral reward event AFTER verified payment ────────────
    // This is the ONLY place a B2B referral reward is triggered. We anchor
    // idempotency on the invoice id so a replayed payment can't double-reward,
    // and we pass the ACTUAL amount the referred gym paid (not a list price)
    // so the rule engine's min_subscription_amount gate sees real money.
    const paidPlanName = dto.plan_id || studio.subscription_plan;
    if (paidPlanName && paidPlanName !== DEFAULT_PLAN) {
      const subscriptionPlan = await this.pub.subscriptionPlan.findFirst({
        where: { name: paidPlanName, is_active: true },
        select: { id: true },
      });
      const eventPayload: SubscriptionActivatedPayload = {
        studioId,
        planId:         subscriptionPlan?.id ?? paidPlanName,
        planName:       paidPlanName,
        billingCycle:   (studio.billing_cycle as 'monthly' | 'annual') ?? 'monthly',
        amountPaid:     paidAmount,
        currency,
        idempotencyKey: renewal.invoice_id,
        activatedAt:    now,
      };
      this.eventEmitter.emit(REFERRAL_EVENTS.SUBSCRIPTION_ACTIVATED, eventPayload);
    }

    return {
      invoice_id: renewal.invoice_id,
      invoice_number: renewal.invoice_number,
      amount: paidAmount,
      currency,
      card_last4: dto.card_last4,
      card_brand: dto.card_brand,
      payment_reference: paymentReference,
      payment_method: paymentMethod,
      status: 'paid',
      next_billing_date: renewal.period_end.toISOString(),
      onboarding_step: 'complete',
    };
  }

  // ── Helper: unique referral code generation ─────────────────────

  private async generateUniqueReferralCode(): Promise<string> {
    const { randomBytes } = await import('crypto');
    for (let attempt = 0; attempt < 10; attempt++) {
      // 4 random bytes → base36 → trim to 6 chars → uppercase
      const raw = parseInt(randomBytes(3).toString('hex'), 16)
        .toString(36)
        .toUpperCase()
        .padStart(6, '0')
        .slice(0, 6);
      const exists = await this.pub.studio.findUnique({
        where: { referral_code: raw },
        select: { id: true },
      });
      if (!exists) return raw;
    }
    // Fallback: UUID prefix
    return randomBytes(3).toString('hex').toUpperCase();
  }

  // ── Skip Onboarding Step ─────────────────────────────────────────────

  async onboardingSkipStep(userId: string, dto: OnboardingSkipStepDto) {
    const STEP_ORDER: Record<string, string> = {
      setup_branches: 'setup_plans',
      setup_plans: 'setup_staff',
      setup_staff: 'select_subscription',
      select_subscription: 'complete',
    };

    const nextStep = STEP_ORDER[dto.current_step];
    if (!nextStep) {
      throw new BadRequestException(`Cannot skip step: ${dto.current_step}`);
    }

    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, onboarding_step: nextStep },
    });

    return { onboarding_step: nextStep };
  }

  // ── Clone Tenant Schema ─────────────────────────────────────────────
  // Copies all table structures (DDL) from studio_template into the new
  // tenant schema so that Prisma queries resolve correctly when
  // search_path is set to the tenant schema.

  private assertValidUuid(value: string, label = 'identifier'): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException(`Invalid ${label}: must be a valid UUID`);
    }
  }

  private async cloneTenantSchema(targetSchema: string): Promise<void> {
    const sourceSchema = 'studio_template';

    // Validate schema name to prevent injection (already validated upstream, but belt-and-suspenders)
    if (!/^studio_[0-9a-f_]+$/i.test(targetSchema)) {
      throw new InternalServerErrorException('Invalid target schema name');
    }

    try {
      // Get all tables in the source schema
      const tables = await this.prisma.$queryRawUnsafe<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        sourceSchema,
      );

      if (tables.length === 0) {
        this.logger.warn(`Source schema "${sourceSchema}" has no tables to clone`);
        return;
      }

      this.logger.log(`Cloning ${tables.length} tables from "${sourceSchema}" to "${targetSchema}"`);

      // Clone each table structure (DDL only, no data) using CREATE TABLE ... LIKE
      // This copies column definitions, defaults, NOT NULL constraints, and indexes
      const identifierRegex = /^[a-z_][a-z0-9_]{0,62}$/i;
      for (const { table_name } of tables) {
        if (!identifierRegex.test(table_name)) {
          this.logger.warn(`Skipping table with unsafe name: ${table_name}`);
          continue;
        }
        await this.prisma.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "${targetSchema}"."${table_name}"
           (LIKE "${sourceSchema}"."${table_name}" INCLUDING ALL)`,
        );
      }

      // Copy foreign key constraints from source schema
      // LIKE ... INCLUDING ALL copies indexes and defaults but NOT foreign keys
      const fks = await this.prisma.$queryRawUnsafe<{
        constraint_name: string;
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
        delete_rule: string;
        update_rule: string;
      }[]>(
        `SELECT
           tc.constraint_name,
           tc.table_name,
           kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name,
           rc.delete_rule,
           rc.update_rule
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
         JOIN information_schema.referential_constraints rc
           ON rc.constraint_name = tc.constraint_name
           AND rc.constraint_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = $1`,
        sourceSchema,
      );

      const ALLOWED_FK_RULES = new Set(['CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'NO ACTION']);
      for (const fk of fks) {
        // Validate all identifier fields fetched from information_schema before interpolation
        const fkIdentifiers = [fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name, fk.constraint_name];
        if (fkIdentifiers.some((id) => !identifierRegex.test(id))) {
          this.logger.warn(`Skipping FK with unsafe identifier: ${JSON.stringify(fkIdentifiers)}`);
          continue;
        }
        // Validate ON DELETE / ON UPDATE rules against an allowlist
        const deleteRuleValid = ALLOWED_FK_RULES.has(fk.delete_rule.toUpperCase());
        const updateRuleValid = ALLOWED_FK_RULES.has(fk.update_rule.toUpperCase());
        if (!deleteRuleValid || !updateRuleValid) {
          this.logger.warn(`Skipping FK with invalid referential action: DELETE=${fk.delete_rule} UPDATE=${fk.update_rule}`);
          continue;
        }
        const onDelete = fk.delete_rule !== 'NO ACTION' ? `ON DELETE ${fk.delete_rule}` : '';
        const onUpdate = fk.update_rule !== 'NO ACTION' ? `ON UPDATE ${fk.update_rule}` : '';
        // Use a unique constraint name for the target schema
        const fkName = `${targetSchema}_${fk.constraint_name}`.slice(0, 63);
        try {
          await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "${targetSchema}"."${fk.table_name}"
             ADD CONSTRAINT "${fkName}"
             FOREIGN KEY ("${fk.column_name}")
             REFERENCES "${targetSchema}"."${fk.foreign_table_name}" ("${fk.foreign_column_name}")
             ${onDelete} ${onUpdate}`,
          );
        } catch {
          // FK might reference a public schema table or already exist — skip
        }
      }

      this.logger.log(`Schema clone complete: ${tables.length} tables in "${targetSchema}"`);
    } catch (error) {
      this.logger.error(`Failed to clone schema "${sourceSchema}" → "${targetSchema}": ${error}`);
      throw new InternalServerErrorException('Failed to initialize studio tables');
    }
  }

  /**
   * Run an async operation inside the correct tenant AsyncLocalStorage context.
   * This ensures the Prisma $use middleware sets the correct search_path,
   * even in auth routes that are excluded from TenantMiddleware.
   */
  private runInTenantContext<T>(schemaName: string, fn: () => Promise<T>, gymId?: string): Promise<T> {
    // gymId must always be the actual studio UUID, NOT derived from schemaName.
    // schemaName is studio_{userId} which is different from studioId.
    if (!gymId) {
      throw new Error('runInTenantContext: gymId (studioId) is required. Do NOT derive from schemaName.');
    }
    return new Promise<T>((resolve, reject) => {
      tenantContext.run({ schemaName, gymId, activeBranchId: null, allowedBranchIds: [], bypassBranchScope: false }, () => {
        fn().then(resolve).catch(reject);
      });
    });
  }
}
