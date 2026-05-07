import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Inject,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generate as totpGenerate, verify as totpVerify, generateSecret as totpGenerateSecret, generateURI as totpGenerateURI } from 'otplib';
import * as QRCode from 'qrcode';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../config/redis.module';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction } from '@prisma/client';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 900; // 15 minutes
const SALT_ROUNDS = 12;
const MFA_SESSION_TTL = 300; // 5 minutes to complete MFA step
const RESET_TOKEN_TTL_MINS = 30;
const BACKUP_CODE_COUNT = 8;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditLogsService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async onModuleInit() {
    await this.ensureSuperAdmin();
  }

  private async ensureSuperAdmin() {
    const email = this.config.get<string>('SUPER_ADMIN_EMAIL');
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD');
    if (!email || !password) return;

    const exists = await this.prisma.adminUser.findUnique({ where: { email } });
    if (exists) return;

    await this.prisma.adminUser.create({
      data: {
        email,
        password_hash: await bcrypt.hash(password, SALT_ROUNDS),
        name: 'Super Admin',
      },
    });
  }

  // ─── Login (step 1 — credentials) ─────────────────────────────────────────

  async login(email: string, password: string, ctx: Omit<AuditContext, 'admin_id'>) {
    const lockKey = `login_attempts:${email}`;
    try {
      const attempts = await this.redis.get(lockKey);
      if (attempts && parseInt(attempts) >= MAX_LOGIN_ATTEMPTS) {
        throw new ForbiddenException('Account locked. Try again in 15 minutes.');
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.warn(`Redis unavailable during login check: ${(err as Error).message}`);
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.is_active) {
      this.incrementLoginAttempts(email).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      this.incrementLoginAttempts(email).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    this.redis.del(lockKey).catch(() => {});

    // If MFA enabled, return a short-lived session token — client must then call /auth/mfa/verify
    if (admin.mfa_enabled && admin.mfa_secret) {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      try {
        await this.redis.setex(`mfa_session:${sessionToken}`, MFA_SESSION_TTL, admin.id);
      } catch (err) {
        this.logger.warn(`Redis unavailable for MFA session: ${(err as Error).message}`);
      }
      return {
        requires_mfa: true,
        mfa_session_token: sessionToken,
      };
    }

    // No MFA — issue full tokens immediately
    return this.issueFullSession(admin, ctx);
  }

  // ─── Login (step 2 — TOTP code) ────────────────────────────────────────────

  async verifyMfaLogin(mfaSessionToken: string, totpCode: string, ctx: Omit<AuditContext, 'admin_id'>) {
    const adminId = await this.redis.get(`mfa_session:${mfaSessionToken}`);
    if (!adminId) throw new UnauthorizedException('MFA session expired or invalid. Please log in again.');

    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.mfa_secret) throw new UnauthorizedException('Invalid session');

    const verifyResult = await totpVerify({ token: totpCode, secret: admin.mfa_secret });
    if (!verifyResult?.valid) throw new UnauthorizedException('Invalid authenticator code. Please try again.');

    await this.redis.del(`mfa_session:${mfaSessionToken}`);
    return this.issueFullSession(admin, ctx);
  }

  // ─── Login (step 2 — recovery code, for lost phone) ──────────────────────

  async verifyRecoveryCode(mfaSessionToken: string, recoveryCode: string, ctx: Omit<AuditContext, 'admin_id'>) {
    const adminId = await this.redis.get(`mfa_session:${mfaSessionToken}`);
    if (!adminId) throw new UnauthorizedException('Session expired. Please log in again.');

    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('Invalid session');

    // Recovery codes are stored as bcrypt hashes; compare each
    const normalised = recoveryCode.toUpperCase().replace(/\s/g, '');
    let matchedHash: string | null = null;
    for (const hash of admin.mfa_backup_codes) {
      if (await bcrypt.compare(normalised, hash)) {
        matchedHash = hash;
        break;
      }
    }

    if (!matchedHash) throw new UnauthorizedException('Invalid or already-used recovery code.');

    // Remove the used code so it cannot be reused
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { mfa_backup_codes: admin.mfa_backup_codes.filter((h) => h !== matchedHash) },
    });

    await this.redis.del(`mfa_session:${mfaSessionToken}`);
    this.logger.warn(`Admin ${admin.email} logged in with a recovery code — ${admin.mfa_backup_codes.length - 1} codes remaining`);
    return this.issueFullSession(admin, ctx);
  }

  // ─── MFA Setup — step 1: generate secret + QR ─────────────────────────────

  async initMfaSetup(adminId: string) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (admin.mfa_enabled) throw new BadRequestException('MFA is already enabled.');

    const secret = totpGenerateSecret();
    const issuer = 'MuscleX SCC';
    const otpauth = totpGenerateURI({ issuer, label: admin.email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Store pending secret (not yet confirmed) with a 10-minute TTL in Redis
    await this.redis.setex(`mfa_pending:${adminId}`, 600, secret);

    return {
      secret,
      qr_code: qrDataUrl,
      manual_entry_key: secret,
      issuer,
      account: admin.email,
    };
  }

  // ─── MFA Setup — step 2: confirm with first TOTP code ─────────────────────

  async confirmMfaSetup(adminId: string, totpCode: string) {
    const pendingSecret = await this.redis.get(`mfa_pending:${adminId}`);
    if (!pendingSecret) throw new BadRequestException('Setup session expired. Please start again.');

    const verifyResult = await totpVerify({ token: totpCode, secret: pendingSecret });
    if (!verifyResult?.valid) throw new BadRequestException('Invalid code. Scan the QR again and try once more.');

    // Generate backup recovery codes
    const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      `${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
    );
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { mfa_enabled: true, mfa_secret: pendingSecret, mfa_backup_codes: hashedCodes },
    });

    await this.redis.del(`mfa_pending:${adminId}`);
    this.logger.log(`MFA enabled for admin ${adminId}`);

    return {
      success: true,
      backup_codes: plainCodes, // shown ONCE — user must save these
    };
  }

  // ─── MFA Disable ──────────────────────────────────────────────────────────

  async disableMfa(adminId: string, password: string) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.mfa_enabled) throw new BadRequestException('MFA is not enabled.');

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) throw new UnauthorizedException('Incorrect password.');

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { mfa_enabled: false, mfa_secret: null, mfa_backup_codes: [], mfa_pending_secret: null },
    });

    this.logger.warn(`MFA disabled for admin ${adminId}`);
    return { success: true };
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(adminId: string) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminId },
      select: { id: true, email: true, name: true, mfa_enabled: true, last_login_at: true, created_at: true, mfa_backup_codes: true },
    });
    return {
      ...admin,
      backup_codes_remaining: admin.mfa_backup_codes.length,
      mfa_backup_codes: undefined, // never expose hashes
    };
  }

  async updateProfile(adminId: string, name: string) {
    const updated = await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { name },
      select: { id: true, email: true, name: true, mfa_enabled: true },
    });
    return updated;
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    const valid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');

    if (currentPassword === newPassword) throw new BadRequestException('New password must differ from current password.');

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { password_hash: hash } });
    // Revoke all refresh tokens (force re-login everywhere)
    await this.redis.del(`refresh_token:${adminId}`);
    return { success: true };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    // Always return success (prevents email enumeration)
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.is_active) return { success: true };

    // Invalidate previous tokens
    await (this.prisma as any).passwordResetToken.deleteMany({ where: { admin_id: admin.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINS * 60 * 1000);

    await (this.prisma as any).passwordResetToken.create({
      data: { admin_id: admin.id, token_hash: tokenHash, expires_at: expiresAt },
    });

    const resetUrl = `${this.config.get('SCC_FRONTEND_URL', 'http://localhost:3001')}/reset-password?token=${token}`;
    this.logger.log(`Password reset requested for ${email}. Reset URL (dev): ${resetUrl}`);

    // In production wire to email provider (Resend/SMTP). For now log the URL.
    // TODO: await this.mailer.send({ to: email, subject: 'Reset your password', html: `...` });

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await (this.prisma as any).passwordResetToken.findUnique({ where: { token_hash: tokenHash } });

    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id: record.admin_id } });
    if (!admin) throw new NotFoundException('Admin not found');

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await Promise.all([
      this.prisma.adminUser.update({ where: { id: admin.id }, data: { password_hash: hash } }),
      (this.prisma as any).passwordResetToken.update({ where: { id: record.id }, data: { used_at: new Date() } }),
      this.redis.del(`refresh_token:${admin.id}`),
    ]);

    return { success: true };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const stored = await this.redis.get(`refresh_token:${payload.sub}`);
      if (!stored || stored !== refreshToken) throw new UnauthorizedException('Token revoked');
      const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
      if (!admin || !admin.is_active) throw new UnauthorizedException();
      return this.generateTokens(admin.id, admin.email);
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ─── Impersonation ────────────────────────────────────────────────────────

  async generateImpersonationToken(tenantId: string, adminCtx: AuditContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new UnauthorizedException('Tenant not found');

    const token = this.jwt.sign(
      { sub: adminCtx.admin_id, email: tenant.owner_email, tenant_id: tenantId, type: 'impersonation' },
      { expiresIn: '1h' },
    );

    await this.audit.log(AuditAction.IMPERSONATE, 'tenant', tenantId, adminCtx);
    return { impersonation_token: token, tenant_id: tenantId, expires_in: '1h' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async issueFullSession(admin: { id: string; email: string; name: string }, ctx: Omit<AuditContext, 'admin_id'>) {
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { last_login_at: new Date() } });
    const tokens = await this.generateTokens(admin.id, admin.email);
    await this.audit.log(AuditAction.LOGIN, 'admin_user', admin.id, { admin_id: admin.id, ...ctx });
    return {
      requires_mfa: false,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  private async generateTokens(userId: string, email: string) {
    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync({ sub: userId, email, type: 'access' }),
      this.jwt.signAsync(
        { sub: userId, email, type: 'refresh' },
        { secret: this.config.get<string>('JWT_REFRESH_SECRET'), expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRY', '7d') },
      ),
    ]);
    this.redis.setex(`refresh_token:${userId}`, 7 * 24 * 60 * 60, refresh_token).catch(() => {});
    return { access_token, refresh_token };
  }

  private async incrementLoginAttempts(email: string) {
    const key = `login_attempts:${email}`;
    const current = await this.redis.incr(key);
    if (current === 1) await this.redis.expire(key, LOCKOUT_SECONDS);
  }
}
