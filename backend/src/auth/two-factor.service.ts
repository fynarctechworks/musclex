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
import { AuthSessionService } from './auth-session.service';
import { AuthDeviceService } from './auth-device.service';
import { AuthLoginHistoryService } from './auth-login-history.service';
import { RbacService } from './rbac.service';

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
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly encryptionKey: Buffer;
  /** Pending Supabase sessions waiting for 2FA verification, keyed by user_id */
  private pendingSessions = new Map<string, PendingSession>();

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
    const keySource = secret || this.configService.get<string>('JWT_SECRET', 'fitsync-2fa-default-key');
    this.encryptionKey = createHash('sha256').update(keySource).digest();
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
      name: `FitSync:${identity.email}`,
      issuer: 'FitSync',
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

    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: {
        two_factor_enabled: true,
        two_factor_backup_codes: hashedCodes,
      },
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

    // Recover the Supabase session from server-side pending store
    const pending = this.pendingSessions.get(payload.user_id);
    if (!pending || pending.expires_at < Date.now()) {
      this.pendingSessions.delete(payload.user_id);
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Consume the pending session (one-time use)
    this.pendingSessions.delete(payload.user_id);
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

  generateTempToken(
    userId: string,
    email: string,
    supabaseSession?: { access_token: string; refresh_token: string },
  ): string {
    // Store Supabase session server-side (not in the JWT — avoids size/encoding issues)
    if (supabaseSession) {
      this.pendingSessions.set(userId, {
        access_token: supabaseSession.access_token,
        refresh_token: supabaseSession.refresh_token,
        expires_at: Date.now() + 5 * 60 * 1000, // 5 minutes
      });
    }

    // Clean up any expired entries periodically
    this.cleanupExpiredSessions();

    return this.jwtService.sign(
      { user_id: userId, email, purpose: '2fa_challenge' } satisfies TempTokenPayload,
      { expiresIn: '5m' },
    );
  }

  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [key, session] of this.pendingSessions) {
      if (session.expires_at < now) {
        this.pendingSessions.delete(key);
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────

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
    storedHashes: string[],
  ): Promise<boolean> {
    const hash = this.hashBackupCode(code);
    const idx = storedHashes.indexOf(hash);
    if (idx === -1) return false;

    // Remove used backup code
    const remaining = [...storedHashes];
    remaining.splice(idx, 1);
    await this.prisma.userIdentity.update({
      where: { id: userId },
      data: { two_factor_backup_codes: remaining },
    });

    this.logger.log(`Backup code used for user ${userId}. ${remaining.length} codes remaining.`);
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
