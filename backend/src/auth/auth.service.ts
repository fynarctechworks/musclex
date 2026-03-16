import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { Resend } from 'resend';
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
} from './dto';
import { PLAN_CONFIGS, fetchAvailablePlans } from '../common/plan-configs';
import { AuthIdentityService } from './auth-identity.service';
import { AuthDeviceService } from './auth-device.service';
import { AuthLoginHistoryService } from './auth-login-history.service';
import { AuthSessionService } from './auth-session.service';
import { RbacService } from './rbac.service';
import { RbacSeedService } from './rbac-seed.service';
import { TwoFactorService } from './two-factor.service';

/** Request context passed from the controller for tracking. */
export interface LoginContext {
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private resend: Resend | null = null;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private identityService: AuthIdentityService,
    private deviceService: AuthDeviceService,
    private loginHistoryService: AuthLoginHistoryService,
    private sessionService: AuthSessionService,
    private rbacService: RbacService,
    private rbacSeedService: RbacSeedService,
    private twoFactorService: TwoFactorService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
    const resendKey = this.configService.get<string>('RESEND_API_KEY', '');
    if (resendKey) {
      this.resend = new Resend(resendKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — verification emails will only be logged to console');
    }
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

    // ── Successful authentication ──

    const metadata = data.user.user_metadata || {};
    const onboardingStep = metadata.onboarding_step;

    // Sync identity to local table (persistent user record)
    await this.identityService.syncIdentity({
      id: data.user.id,
      email: data.user.email!,
      full_name: metadata.full_name || '',
      phone: metadata.phone,
      email_verified: !!data.user.email_confirmed_at,
    });

    // Track device
    let deviceId: string | undefined;
    const device = await this.deviceService.trackDevice(data.user.id, {
      device_fingerprint: dto.device_info?.device_fingerprint,
      device_name: dto.device_info?.device_name,
      device_type: dto.device_info?.device_type,
      user_agent: ua,
      ip_address: ip,
    });
    if (device.id) deviceId = device.id;

    // ── 2FA challenge interception ──
    const identity2fa = await this.prisma.userIdentity.findUnique({
      where: { id: data.user.id },
      select: { two_factor_enabled: true },
    });
    if (identity2fa?.two_factor_enabled) {
      // Keep the Supabase session alive — pass encrypted tokens to temp JWT
      // They'll be returned after successful OTP verification
      const tempToken = this.twoFactorService.generateTempToken(
        data.user.id,
        data.user.email!,
        data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        } : undefined,
      );

      await this.loginHistoryService.record({
        user_id: data.user.id,
        email: dto.email,
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
    if (data.session?.access_token) {
      sessionId = await this.sessionService.createSession({
        user_id: data.user.id,
        access_token: data.session.access_token,
        device_id: deviceId,
        ip_address: ip,
        studio_id: metadata.studio_id,
      });
    }

    // Record successful login
    await this.loginHistoryService.record({
      user_id: data.user.id,
      email: dto.email,
      ip_address: ip,
      user_agent: ua,
      device_id: deviceId,
      status: 'success',
      studio_id: metadata.studio_id,
    });

    // If still onboarding, return minimal data with step indicator
    if (onboardingStep && onboardingStep !== 'complete') {
      return {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        session_id: sessionId,
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: metadata.full_name,
          role: metadata.role || 'owner',
          studio_id: metadata.studio_id,
          branch_ids: metadata.branch_ids || [],
          onboarding_step: onboardingStep,
        },
        studio: null,
        device: device.is_new ? { id: device.id, is_new_device: true } : undefined,
      };
    }

    // ── Workspace resolution via normalized RBAC ──
    const workspaces = await this.rbacService.getUserWorkspaces(data.user.id);

    if (workspaces.length > 1) {
      // Multiple studios — require workspace selection
      return {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        session_id: sessionId,
        requires_workspace_selection: true,
        workspaces: workspaces.map((w) => ({
          studio_id: w.studio_id,
          studio_name: w.studio_name,
          roles: w.roles.map((r) => r.role_name),
        })),
        user: {
          id: data.user.id,
          email: data.user.email,
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
        data.user.id, studioId,
      );
    }

    // Fully onboarded — fetch studio
    let studio = null;
    if (studioId) {
      try {
        studio = await this.prisma.studio.findUnique({
          where: { id: studioId },
        });
      } catch (err) {
        this.logger.error(`Database error fetching studio: ${err.message}`);
      }
    }

    return {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      session_id: sessionId,
      user: {
        id: data.user.id,
        email: data.user.email,
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

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    await this.supabase.auth.resetPasswordForEmail(dto.email, {
      redirectTo: `${this.configService.get('CORS_ORIGINS', 'http://localhost:3000')}/reset-password`,
    });
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { error } = await this.supabase.auth.admin.updateUserById(dto.otp, {
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

    const existing = await this.prisma.studio.findUnique({
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
    const studio = await this.prisma.studio.create({
      data: {
        name: dto.studio_name,
        slug,
        schema_name: `studio_${authData.user.id.replace(/-/g, '_')}`,
        owner_user_id: authData.user.id,
        timezone: dto.timezone || 'Asia/Kolkata',
        currency: dto.currency || 'INR',
      },
    });

    // Create first branch
    const branch = await this.prisma.branch.create({
      data: {
        name: dto.branch_name,
        address: dto.branch_address,
        city: dto.branch_city,
        phone: dto.branch_phone,
      },
    });

    // Update user metadata with studio_id and branch_ids
    await this.supabase.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        full_name: dto.full_name,
        role: 'owner',
        studio_id: studio.id,
        branch_ids: [branch.id],
      },
    });

    // Create studio schema
    try {
      await this.prisma.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS "${studio.schema_name}"`,
      );
    } catch (error) {
      this.logger.error(`Failed to create schema ${studio.schema_name}`, error);
      throw new InternalServerErrorException('Failed to initialize studio environment');
    }

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
      await this.rbacSeedService.seedStudioRoles();
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
    const studio = await this.prisma.studio.findUnique({
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
    // Remove any previous pending registration for this email (allows re-registration)
    await this.prisma.pendingRegistration.deleteMany({ where: { email: dto.email } });

    // Encrypt password for secure temporary storage (AES-256-GCM)
    const encryptedPassword = this.encryptPassword(dto.password);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.prisma.pendingRegistration.create({
      data: {
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone,
        encrypted_password: encryptedPassword,
        token,
        expires_at: expiresAt,
      },
    });

    const frontendUrl = this.configService
      .get('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')[0]
      .trim();
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    this.logger.log(`📧 Verification link for ${dto.email}: ${verificationUrl}`);
    await this.sendVerificationEmail(dto.email, dto.full_name, verificationUrl);

    // No tokens returned — user must verify email before account exists
    // In dev mode (no RESEND_API_KEY), include the verification URL so the frontend can show it
    const result: Record<string, unknown> = { success: true, email: dto.email };
    if (!this.resend) {
      result.verification_url = verificationUrl;
    }
    return result;
  }

  // ── Email Verification (creates Supabase account after token validated) ──────

  async verifyEmail(dto: VerifyEmailDto) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { token: dto.token },
    });

    if (!pending) {
      throw new BadRequestException(
        'Invalid or expired verification link. Please register again.',
      );
    }

    if (pending.expires_at < new Date()) {
      await this.prisma.pendingRegistration.delete({ where: { token: dto.token } });
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
      // If account already exists (e.g. re-registration after DB truncation),
      // update password and sign in instead of failing
      if (authError?.message?.toLowerCase().includes('already')) {
        // Look up existing user by email in auth.users
        const { data: existingRows } = await this.supabase
          .from('users')  // uses auth schema via service role
          .select('id')
          .eq('email', pending.email)
          .limit(1);

        // Fallback: query auth.users via raw RPC if above fails (different Supabase versions)
        let existingId: string | null = (existingRows as { id: string }[])?.[0]?.id ?? null;

        if (!existingId) {
          // Try the admin API with a broader search
          const { data: listData } = await this.supabase.auth.admin.listUsers({ perPage: 1000 });
          const found = (listData?.users as unknown as Array<{ id: string; email?: string }>)
            ?.find((u) => u.email === pending.email);
          existingId = found?.id ?? null;
        }

        if (!existingId) {
          throw new ConflictException('An account with this email already exists. Please sign in.');
        }

        // Fetch the existing user's metadata
        const { data: existingUser } = await this.supabase.auth.admin.getUserById(existingId);
        const existingMeta = existingUser?.user?.user_metadata || {};
        // Update password to the newly registered one and reset metadata
        await this.supabase.auth.admin.updateUserById(existingId, {
          password,
          user_metadata: {
            ...existingMeta,
            full_name: pending.full_name,
            phone: pending.phone,
            onboarding_step: existingMeta?.onboarding_step || 'studio_info',
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
    await this.prisma.pendingRegistration.delete({ where: { token: dto.token } });

    // Sign in to return session tokens to the frontend
    const { data: signInData } = await this.supabase.auth.signInWithPassword({
      email: pending.email,
      password,
    });

    // Determine current onboarding step
    const metadata = isExistingUser
      ? (await this.supabase.auth.admin.getUserById(userId)).data?.user?.user_metadata
      : authData!.user!.user_metadata;
    const onboardingStep = metadata?.onboarding_step || 'studio_info';

    return {
      access_token: signInData?.session?.access_token,
      refresh_token: signInData?.session?.refresh_token,
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
  }

  // ── Resend Verification (public — takes email in body, no JWT required) ──────

  async resendVerification(email: string) {
    const pending = await this.prisma.pendingRegistration.findFirst({
      where: { email },
    });

    if (!pending) {
      throw new BadRequestException(
        'No pending registration found for this email. Please register again.',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { token, expires_at: expiresAt },
    });

    const frontendUrl = this.configService
      .get('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')[0]
      .trim();
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    this.logger.log(`📧 Resent verification for ${email}: ${verificationUrl}`);
    await this.sendVerificationEmail(email, pending.full_name, verificationUrl);

    const result: Record<string, unknown> = { sent: true };
    if (!this.resend) {
      result.verification_url = verificationUrl;
    }
    return result;
  }

  // ── Send Verification Email ──────────────────────────────

  private async sendVerificationEmail(
    email: string,
    name: string,
    verificationUrl: string,
  ) {
    if (!this.resend) {
      this.logger.warn(`No RESEND_API_KEY — skipping email to ${email}. Use console link above.`);
      return;
    }
    try {
      const fromEmail = this.configService.get(
        'RESEND_FROM_EMAIL',
        'FitSync Pro <onboarding@fitsyncpro.com>',
      );
      await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Verify your FitSync Pro account',
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #3ECF8E; border-radius: 8px; width: 40px; height: 40px; line-height: 40px; text-align: center;">
                <span style="color: #171717; font-weight: bold; font-size: 18px;">F</span>
              </div>
              <p style="font-size: 16px; font-weight: 600; color: #171717; margin: 8px 0 0;">FitSync Pro</p>
            </div>
            <h1 style="font-size: 22px; font-weight: 700; color: #171717; margin-bottom: 8px;">Verify your email</h1>
            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px;">
              Hi${name ? ` ${name}` : ''}, thanks for signing up! Click the button below to verify your email address and continue setting up your studio.
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${verificationUrl}" style="display: inline-block; background: #3ECF8E; color: #171717; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Verify Email Address</a>
            </div>
            <p style="font-size: 12px; color: #999; line-height: 1.5;">
              This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="font-size: 11px; color: #bbb; text-align: center;">FitSync Pro — The complete operating system for modern fitness studios.</p>
          </div>
        `,
      });
      this.logger.log(`✅ Verification email sent to ${email}`);
    } catch (err) {
      this.logger.error(`❌ Failed to send verification email to ${email}: ${err.message}`);
      // Don't throw — registration should still succeed even if email fails
      // The user can use the resend button
    }
  }

  // ── AES-256-GCM Password Encryption (for temporary pending_registrations storage) ──

  private static readonly ENCRYPTION_SALT = 'fitsync-pending-reg-v1';

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
    return fetchAvailablePlans(this.prisma);
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
      ? await this.prisma.studio.findUnique({ where: { id: metadata.studio_id } })
      : await this.prisma.studio.findFirst({ where: { owner_user_id: userId } });

    const existing = await this.prisma.studio.findUnique({
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
      studio = await this.prisma.studio.update({
        where: { id: existingStudio.id },
        data: {
          name: dto.studio_name,
          slug,
          business_type: dto.business_type,
          phone: dto.phone,
          email: dto.email || email,
          country: dto.country,
          website: dto.website,
          logo_url: dto.logo_url,
          timezone: dto.timezone || existingStudio.timezone || 'Asia/Kolkata',
          currency: dto.currency || existingStudio.currency || 'INR',
          email_verified: true,
        },
      });
    } else {
      studio = await this.prisma.studio.create({
        data: {
          name: dto.studio_name,
          slug,
          schema_name: schemaName,
          owner_user_id: userId,
          business_type: dto.business_type,
          phone: dto.phone,
          email: dto.email || email,
          country: dto.country,
          website: dto.website,
          logo_url: dto.logo_url,
          timezone: dto.timezone || 'Asia/Kolkata',
          currency: dto.currency || 'INR',
          subscription_plan: 'free',
          subscription_status: 'trial',
          subscription_start: now,
          email_verified: true,
        },
      });

      try {
        await this.prisma.$executeRawUnsafe(
          `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
        );
      } catch (error) {
        this.logger.error(`Failed to create schema ${schemaName}`, error);
        throw new InternalServerErrorException('Failed to initialize studio environment');
      }

      branch = await this.prisma.branch.create({
        data: {
          name: 'Main Branch',
          country: dto.country,
          phone: dto.phone,
        },
      });
    }

    if (!branch) {
      branch = await this.prisma.branch.create({
        data: {
          name: 'Main Branch',
          country: dto.country,
          phone: dto.phone,
        },
      });
    }

    // Set up user metadata — advance to next onboarding step
    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        role: 'owner',
        studio_id: studio.id,
        branch_ids: [branch.id],
        onboarding_step: 'setup_branches',
      },
    });

    // Seed RBAC roles for the studio
    try {
      await this.rbacSeedService.seedStudioRoles();
    } catch (e) {
      this.logger.warn(`RBAC seed partially failed: ${e}`);
    }

    // Assign owner role
    try {
      await this.prisma.userRole.upsert({
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
        branch_ids: [branch.id],
        onboarding_step: 'setup_branches',
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
    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};
    const studioId = metadata.studio_id;

    if (!studioId) {
      throw new BadRequestException('Studio not yet created. Complete studio setup first.');
    }

    const createdBranches: string[] = [...(metadata.branch_ids || [])];

    for (const b of dto.branches) {
      const branch = await this.prisma.branch.create({
        data: {
          name: b.name,
          address: b.address,
          city: b.city,
          state: b.state,
          country: b.country,
          postal_code: b.postal_code,
          phone: b.phone,
        },
      });
      createdBranches.push(branch.id);
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

    if (!studioId) {
      throw new BadRequestException('Studio not yet created.');
    }

    const createdPlans: string[] = [];

    for (const p of dto.plans) {
      const plan = await this.prisma.membershipPlan.create({
        data: {
          name: p.name,
          description: p.description,
          plan_type: p.plan_type,
          duration_days: p.duration_days,
          price: p.price,
          currency: p.currency || 'INR',
          branch_id: branchIds[0] || undefined,
          is_active: true,
        },
      });
      createdPlans.push(plan.id);
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

    if (!studioId) {
      throw new BadRequestException('Studio not yet created.');
    }

    const createdStaff: string[] = [];

    for (const s of dto.staff) {
      const staff = await this.prisma.staff.create({
        data: {
          full_name: s.full_name,
          role: s.role,
          email: s.email || undefined,
          phone: s.phone || '',
          branch_id: branchIds[0] || undefined,
          status: 'active',
        },
      });
      createdStaff.push(staff.id);
    }

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, onboarding_step: 'select_subscription' },
    });

    return { staff_ids: createdStaff, onboarding_step: 'select_subscription' };
  }

  // ── Onboarding Step 7: Select Subscription ───────────────────────────

  async onboardingSelectSubscription(userId: string, planId: string) {
    if (!PLAN_CONFIGS[planId]) {
      throw new BadRequestException(`Invalid plan: ${planId}`);
    }

    const { data: userData } = await this.supabase.auth.admin.getUserById(userId);
    const metadata = userData?.user?.user_metadata || {};
    const studioId = metadata.studio_id;

    if (!studioId) {
      throw new BadRequestException('Studio not yet created.');
    }

    // Update studio subscription
    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setDate(nextBilling.getDate() + 30);

    await this.prisma.studio.update({
      where: { id: studioId },
      data: {
        subscription_plan: planId,
        subscription_status: planId === 'free' ? 'active' : 'trial',
        subscription_start: now,
        trial_ends_at: planId !== 'free' ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
        next_billing_date: planId !== 'free' ? nextBilling : null,
      },
    });

    await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, selected_plan: planId, onboarding_step: 'complete' },
    });

    return { plan: planId, onboarding_step: 'complete' };
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
}
