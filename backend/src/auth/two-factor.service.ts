import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import { Resend } from 'resend';
import { Prisma } from '@prisma/client';
import { AuthSessionService } from './auth-session.service';
import { AuthDeviceService } from './auth-device.service';
import { AuthLoginHistoryService } from './auth-login-history.service';
import { RbacService } from './rbac.service';
import Redis from 'ioredis';

/** Short-lived temp token for the 2FA login challenge */
interface TempTokenPayload {
  user_id: string;
  email: string;
  purpose: '2fa_challenge';
}

/** In-memory store for pending 2FA Supabase sessions (avoids JWT size/encryption issues) */
interface PendingSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms
}

@Injectable()
export class TwoFactorService {
  private supabase: SupabaseClient;
  private resend: Resend | null = null;
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly encryptionKey: Buffer;
  private readonly frontendUrl: string;
  /** Redis client for distributed 2FA pending sessions (falls back to in-memory Map if Redis unavailable) */
  private redis: Redis | null = null;
  private pendingSessionsFallback = new Map<string, PendingSession>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: AuthSessionService,
    private deviceService: AuthDeviceService,
    private loginHistoryService: AuthLoginHistoryService,
    private rbacService: RbacService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
    // Derive a 32-byte key for AES-256 secret encryption
    const secret = this.configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY', '');
    const keySource = secret || this.configService.get<string>('JWT_SECRET');
    if (!keySource) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY (or JWT_SECRET) must be set in environment');
    }
    this.encryptionKey = createHash('sha256').update(keySource).digest();

    // Resend email client
    const resendKey = this.configService.get<string>('RESEND_API_KEY', '');
    if (resendKey) {
      this.resend = new Resend(resendKey);
    }
    this.frontendUrl = this.configService
      .get('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')[0]
      .trim();

    // Initialize Redis for distributed pending session storage
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 200, 3000),
      });
      this.redis.connect().catch((err) => {
        this.logger.warn(`Redis unavailable for 2FA sessions, falling back to in-memory: ${err.message}`);
        this.redis = null;
      });
    }
  }

  private async storePendingSession(userId: string, session: PendingSession): Promise<void> {
    if (this.redis) {
      await this.redis.setex(`2fa:pending:${userId}`, 300, JSON.stringify(session));
    } else {
      this.pendingSessionsFallback.set(userId, session);
    }
  }

  private async consumePendingSession(userId: string): Promise<PendingSession | null> {
    if (this.redis) {
      const raw = await this.redis.get(`2fa:pending:${userId}`);
      if (!raw) return null;
      await this.redis.del(`2fa:pending:${userId}`);
      return JSON.parse(raw) as PendingSession;
    }
    const session = this.pendingSessionsFallback.get(userId) ?? null;
    this.pendingSessionsFallback.delete(userId);
    return session;
  }

  private async deletePendingSession(userId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`2fa:pending:${userId}`);
    } else {
      this.pendingSessionsFallback.delete(userId);
    }
  }

  // ── Setup: generate TOTP secret + QR ────────────────────

  async setup(userId: string) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: userId },
    });
    if (!identity) throw new BadRequestException('User not found');

    if (identity.two_factor_enabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `${this.configService.get<string>('TOTP_ISSUER', 'MuscleX')}:${identity.email}`,
      issuer: this.configService.get<string>('TOTP_ISSUER', 'MuscleX'),
      length: 20,
    });

    // Encrypt the secret before storing (pending setup — not yet verified)
    const encrypted = this.encryptSecret(secret.base32);
    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: {
        two_factor_secret: encrypted,
        two_factor_method: 'totp',
      },
    });

    const otpauthUrl = secret.otpauth_url!;
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return {
      qr_code: qrCode,
      manual_key: secret.base32,
      otpauth_url: otpauthUrl,
    };
  }

  // ── Verify setup: confirm code + enable 2FA ─────────────

  async verifySetup(userId: string, code: string) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: userId },
    });
    if (!identity) throw new BadRequestException('User not found');

    if (identity.two_factor_enabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    if (!identity.two_factor_secret) {
      throw new BadRequestException('No 2FA setup in progress. Call /auth/2fa/setup first.');
    }

    const decrypted = this.decryptSecret(identity.two_factor_secret);
    const verified = speakeasy.totp.verify({
      secret: decrypted,
      encoding: 'base32',
      token: code,
      window: 1, // ±1 window drift (30s each side)
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code. Check your authenticator app and try again.');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);
    const hashedCodes = backupCodes.map((c) => this.hashBackupCode(c));

    // Create backup code records (no longer storing in array)
    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: {
        two_factor_enabled: true,
        // Keep array for backward compatibility but mark as deprecated
        two_factor_backup_codes: [],
      },
    });

    // Insert new backup codes into the backup_code table
    await this.prisma.backupCode.createMany({
      data: hashedCodes.map((hash) => ({
        user_identity_id: userId,
        code_hash: hash,
      })),
    });

    this.logger.log(`2FA enabled for user ${userId}`);

    return {
      enabled: true,
      backup_codes: backupCodes, // Show once, never again
    };
  }

  // ── Login step-2: verify TOTP during login ──────────────

  async verifyLogin(
    tempToken: string,
    code: string,
    context?: { ip_address?: string; user_agent?: string },
  ) {
    // Verify temp token
    let payload: TempTokenPayload;
    try {
      payload = this.jwtService.verify<TempTokenPayload>(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token. Please log in again.');
    }

    if (payload.purpose !== '2fa_challenge') {
      throw new UnauthorizedException('Invalid token type');
    }

    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: payload.user_id },
    });
    if (!identity || !identity.two_factor_enabled || !identity.two_factor_secret) {
      throw new UnauthorizedException('2FA is not configured for this account');
    }

    // Try TOTP code first
    const decrypted = this.decryptSecret(identity.two_factor_secret);
    let valid = speakeasy.totp.verify({
      secret: decrypted,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    // If TOTP failed, try backup code
    if (!valid) {
      valid = await this.tryBackupCode(identity.id, code, identity.two_factor_backup_codes);
    }

    if (!valid) {
      await this.loginHistoryService.record({
        user_id: payload.user_id,
        email: payload.email,
        ip_address: context?.ip_address,
        user_agent: context?.user_agent,
        status: 'failed',
        failure_reason: '2fa_invalid_code',
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    // Recover the Supabase session from server-side pending store (Redis or fallback)
    const pending = await this.consumePendingSession(payload.user_id);
    if (!pending || pending.expires_at < Date.now()) {
      await this.deletePendingSession(payload.user_id);
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    const accessToken = pending.access_token;
    const refreshToken = pending.refresh_token;

    // Verify user still exists
    const { data: userData } = await this.supabase.auth.admin.getUserById(payload.user_id);
    if (!userData?.user) {
      throw new UnauthorizedException('User not found');
    }

    const metadata = userData.user.user_metadata || {};
    const ip = context?.ip_address;
    const ua = context?.user_agent;

    // Track device
    const device = await this.deviceService.trackDevice(payload.user_id, {
      user_agent: ua,
      ip_address: ip,
    });

    // Create session
    const sessionId = await this.sessionService.createSession({
      user_id: payload.user_id,
      access_token: accessToken,
      device_id: device.id || undefined,
      ip_address: ip,
      studio_id: metadata.studio_id,
    });

    // Record success
    await this.loginHistoryService.record({
      user_id: payload.user_id,
      email: payload.email,
      ip_address: ip,
      user_agent: ua,
      device_id: device.id || undefined,
      status: 'success',
      studio_id: metadata.studio_id,
      metadata: { method: '2fa_totp' },
    });

    // Resolve workspaces
    const workspaces = await this.rbacService.getUserWorkspaces(payload.user_id);

    if (workspaces.length > 1) {
      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        session_id: sessionId,
        requires_workspace_selection: true,
        workspaces: workspaces.map((w) => ({
          studio_id: w.studio_id,
          studio_name: w.studio_name,
          roles: w.roles.map((r) => r.role_name),
        })),
        user: {
          id: payload.user_id,
          email: payload.email,
          full_name: metadata.full_name,
        },
      };
    }

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
        payload.user_id, studioId,
      );
    }

    let studio = null;
    if (studioId) {
      try {
        studio = await this.prisma.studio.findUnique({ where: { id: studioId } });
      } catch (err) {
        this.logger.error(`Studio fetch error: ${err.message}`);
      }
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      session_id: sessionId,
      user: {
        id: payload.user_id,
        email: payload.email,
        full_name: metadata.full_name,
        role,
        roles,
        studio_id: studioId,
        branch_ids: branchIds,
        permission_codes: permissionCodes,
      },
      studio,
    };
  }

  // ── Disable 2FA ─────────────────────────────────────────

  async disable(userId: string, password: string) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: userId },
    });
    if (!identity) throw new BadRequestException('User not found');

    if (!identity.two_factor_enabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    // Verify password via Supabase
    const { error } = await this.supabase.auth.signInWithPassword({
      email: identity.email,
      password,
    });

    if (error) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_method: null,
        two_factor_backup_codes: [],
      },
    });

    this.logger.log(`2FA disabled for user ${userId}`);
    return { disabled: true };
  }

  // ── Get 2FA status ──────────────────────────────────────

  async getStatus(userId: string) {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: userId },
      select: {
        two_factor_enabled: true,
        two_factor_method: true,
      },
    });

    return {
      enabled: identity?.two_factor_enabled ?? false,
      method: identity?.two_factor_method ?? null,
    };
  }

  // ── Generate temp token for 2FA challenge ───────────────

  async generateTempToken(
    userId: string,
    email: string,
    supabaseSession?: { access_token: string; refresh_token: string },
  ): Promise<string> {
    // Store Supabase session server-side in Redis (or fallback Map)
    if (supabaseSession) {
      await this.storePendingSession(userId, {
        access_token: supabaseSession.access_token,
        refresh_token: supabaseSession.refresh_token,
        expires_at: Date.now() + 5 * 60 * 1000, // 5 minutes
      });
    }

    // Clean up expired fallback entries (Redis TTL handles expiry automatically)
    this.cleanupExpiredFallbackSessions();

    return this.jwtService.sign(
      { user_id: userId, email, purpose: '2fa_challenge' } satisfies TempTokenPayload,
      { expiresIn: '5m' },
    );
  }

  private cleanupExpiredFallbackSessions() {
    const now = Date.now();
    for (const [key, session] of this.pendingSessionsFallback) {
      if (session.expires_at < now) {
        this.pendingSessionsFallback.delete(key);
      }
    }
  }

  // ── 2FA Recovery ────────────────────────────────────────

  /**
   * Request a 2FA recovery email.
   * Always returns { sent: true } to prevent email enumeration.
   */
  async requestRecovery(email: string): Promise<{ sent: boolean }> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { email },
    });

    // Silent success — never reveal whether the email exists or has 2FA
    if (!identity || !identity.two_factor_enabled) {
      this.logger.log(`2FA recovery requested for unknown/non-2FA email: ${email}`);
      return { sent: true };
    }

    // Generate single-use recovery token (expires in 10 minutes)
    const recoveryToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const currentMetadata = (identity.metadata as Record<string, unknown>) || {};
    await this.prisma.userIdentity.update({
      where: { id: identity.id },
      data: {
        metadata: {
          ...currentMetadata,
          recovery_token: this.hashRecoveryToken(recoveryToken),
          recovery_token_expires_at: expiresAt,
        } as Prisma.InputJsonValue,
      },
    });

    // Send recovery email
    const recoveryUrl = `${this.frontendUrl}/auth/reset-2fa?token=${recoveryToken}`;
    await this.sendRecoveryEmail(identity.email, identity.full_name, recoveryUrl);

    this.logger.log(`2FA recovery token generated for user ${identity.id}`);
    return { sent: true };
  }

  /**
   * Complete 2FA reset using recovery token + password confirmation.
   */
  async resetWithRecovery(
    token: string,
    password: string,
  ): Promise<{ reset: boolean }> {
    const tokenHash = this.hashRecoveryToken(token);

    // Find user by hashed recovery token in metadata
    // We query all users with 2FA enabled and check metadata
    const identities = await this.prisma.userIdentity.findMany({
      where: { two_factor_enabled: true },
      select: {
        id: true,
        email: true,
        full_name: true,
        metadata: true,
      },
    });

    const identity = identities.find((u) => {
      const meta = u.metadata as Record<string, unknown> | null;
      return meta?.recovery_token === tokenHash;
    });

    if (!identity) {
      throw new BadRequestException(
        'Invalid or expired recovery link. Please request a new one.',
      );
    }

    const meta = identity.metadata as Record<string, unknown>;
    const expiresAt = meta.recovery_token_expires_at as string | undefined;
    if (!expiresAt || new Date(expiresAt) < new Date()) {
      // Clear expired token
      await this.clearRecoveryToken(identity.id, meta);
      throw new BadRequestException(
        'Recovery link has expired. Please request a new one.',
      );
    }

    // Verify password via Supabase (confirms the user's identity)
    const { error } = await this.supabase.auth.signInWithPassword({
      email: identity.email,
      password,
    });
    if (error) {
      throw new UnauthorizedException(
        'Invalid password. Please enter your account password to confirm the reset.',
      );
    }

    // Reset all 2FA fields
    await this.prisma.userIdentity.update({
      where: { id: identity.id },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_method: null,
        two_factor_backup_codes: [],
        metadata: {
          ...meta,
          recovery_token: null,
          recovery_token_expires_at: null,
        } as Prisma.InputJsonValue,
      },
    });

    // Log security event
    await this.loginHistoryService.record({
      user_id: identity.id,
      email: identity.email,
      status: 'success',
      metadata: { event: '2fa_reset_via_recovery' },
    });

    // Send alert email
    await this.send2faResetNotification(identity.email, identity.full_name);

    this.logger.log(`2FA reset via recovery for user ${identity.id}`);
    return { reset: true };
  }

  /**
   * Admin-initiated 2FA reset for a specific user.
   */
  async adminReset2fa(userId: string, adminUserId: string): Promise<{ reset: boolean }> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { id: userId },
    });
    if (!identity) throw new BadRequestException('User not found');

    if (!identity.two_factor_enabled) {
      throw new BadRequestException('Two-factor authentication is not enabled for this user');
    }

    // Reset all 2FA fields
    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_method: null,
        two_factor_backup_codes: [],
      },
    });

    // Log security event
    await this.loginHistoryService.record({
      user_id: userId,
      email: identity.email,
      status: 'success',
      metadata: {
        event: '2fa_reset_by_admin',
        admin_user_id: adminUserId,
      },
    });

    // Send alert email
    await this.send2faResetNotification(identity.email, identity.full_name);

    this.logger.log(`2FA admin-reset for user ${userId} by admin ${adminUserId}`);
    return { reset: true };
  }

  // ── Helpers ─────────────────────────────────────────────

  private hashRecoveryToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async clearRecoveryToken(
    userId: string,
    currentMeta: Record<string, unknown>,
  ) {
    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: {
        metadata: {
          ...currentMeta,
          recovery_token: null,
          recovery_token_expires_at: null,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async sendRecoveryEmail(
    email: string,
    name: string,
    recoveryUrl: string,
  ) {
    if (!this.resend) {
      this.logger.warn(
        `No RESEND_API_KEY — 2FA recovery link for ${email}: ${recoveryUrl}`,
      );
      return;
    }
    try {
      const fromEmail = this.configService.get(
        'RESEND_FROM_EMAIL',
        'MuscleX <security@fitsyncpro.com>',
      );
      await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Reset your two-factor authentication — MuscleX',
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #3ECF8E; border-radius: 8px; width: 40px; height: 40px; line-height: 40px; text-align: center;">
                <span style="color: #171717; font-weight: bold; font-size: 18px;">F</span>
              </div>
              <p style="font-size: 16px; font-weight: 600; color: #171717; margin: 8px 0 0;">MuscleX</p>
            </div>
            <h1 style="font-size: 22px; font-weight: 700; color: #171717; margin-bottom: 8px;">Reset your 2FA</h1>
            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px;">
              Hi${name ? ` ${name}` : ''}, we received a request to reset the two-factor authentication on your account.
              Click the button below to proceed. You'll need to confirm your password.
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${recoveryUrl}" style="display: inline-block; background: #EF4444; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Reset Two-Factor Authentication</a>
            </div>
            <p style="font-size: 12px; color: #999; line-height: 1.5;">
              This link expires in <strong>10 minutes</strong> and can only be used once.
              If you didn't request this, you can safely ignore this email — your account is still secure.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="font-size: 11px; color: #bbb; text-align: center;">MuscleX — The complete operating system for modern fitness studios.</p>
          </div>
        `,
      });
      this.logger.log(`✅ 2FA recovery email sent to ${email}`);
    } catch (err) {
      this.logger.error(`❌ Failed to send 2FA recovery email to ${email}: ${err.message}`);
    }
  }

  private async send2faResetNotification(email: string, name: string) {
    if (!this.resend) {
      this.logger.warn(`No RESEND_API_KEY — skipping 2FA reset notification to ${email}`);
      return;
    }
    try {
      const fromEmail = this.configService.get(
        'RESEND_FROM_EMAIL',
        'MuscleX <security@fitsyncpro.com>',
      );
      await this.resend.emails.send({
        from: fromEmail,
        to: email,
        subject: '⚠️ Two-factor authentication was reset — MuscleX',
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #3ECF8E; border-radius: 8px; width: 40px; height: 40px; line-height: 40px; text-align: center;">
                <span style="color: #171717; font-weight: bold; font-size: 18px;">F</span>
              </div>
              <p style="font-size: 16px; font-weight: 600; color: #171717; margin: 8px 0 0;">MuscleX</p>
            </div>
            <h1 style="font-size: 22px; font-weight: 700; color: #171717; margin-bottom: 8px;">2FA was reset on your account</h1>
            <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px;">
              Hi${name ? ` ${name}` : ''}, your two-factor authentication has been reset due to an account recovery request.
              You will need to set up 2FA again on your next login.
            </p>
            <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="font-size: 13px; color: #B91C1C; margin: 0; font-weight: 600;">⚠️ If this wasn't you, contact support immediately.</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="font-size: 11px; color: #bbb; text-align: center;">MuscleX — The complete operating system for modern fitness studios.</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`❌ Failed to send 2FA reset notification to ${email}: ${err.message}`);
    }
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const part1 = randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
      const part2 = randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }

  private hashBackupCode(code: string): string {
    return createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
  }

  private async tryBackupCode(
    userId: string,
    code: string,
    storedHashes: string[], // deprecated - kept for backward compatibility
  ): Promise<boolean> {
    const hash = this.hashBackupCode(code);

    // First try the new backup_code table
    const backupCode = await this.prisma.backupCode.findFirst({
      where: {
        user_identity_id: userId,
        code_hash: hash,
      },
    });

    if (backupCode) {
      // Check if already used
      if (backupCode.used_at) {
        this.logger.warn(`Attempted reuse of backup code for user ${userId}`);
        return false; // Code already used
      }

      // Mark as used
      await this.prisma.backupCode.update({
        where: { id: backupCode.id },
        data: { used_at: new Date() },
      });

      // Count remaining unused codes
      const remaining = await this.prisma.backupCode.count({
        where: {
          user_identity_id: userId,
          used_at: null,
        },
      });

      this.logger.log(`Backup code used for user ${userId}. ${remaining} codes remaining.`);
      return true;
    }

    // Fallback to deprecated array-based codes for backward compatibility
    const idx = storedHashes.indexOf(hash);
    if (idx === -1) return false;

    const remaining = [...storedHashes];
    remaining.splice(idx, 1);
    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: { two_factor_backup_codes: remaining },
    });

    this.logger.log(`Backup code used (legacy) for user ${userId}. ${remaining.length} codes remaining.`);
    return true;
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptSecret(encrypted: string): string {
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
