import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a session record for a successful login.
   */
  async createSession(params: {
    user_id: string;
    access_token: string;
    device_id?: string;
    ip_address?: string;
    studio_id?: string;
    expires_in_hours?: number;
  }): Promise<string> {
    const tokenHash = this.hashToken(params.access_token);
    const expiresAt = new Date(
      Date.now() + (params.expires_in_hours || 24) * 60 * 60 * 1000,
    );

    try {
      const session = await this.prisma.userSession.create({
        data: {
          user_id: params.user_id,
          token_hash: tokenHash,
          device_id: params.device_id || undefined,
          ip_address: params.ip_address,
          studio_id: params.studio_id,
          is_active: true,
          expires_at: expiresAt,
        },
      });
      return session.id;
    } catch (err) {
      this.logger.error(`Failed to create session: ${err.message}`);
      return '';
    }
  }

  /**
   * Validate a session by its access token. Returns session if valid.
   */
  async validateSession(accessToken: string) {
    const tokenHash = this.hashToken(accessToken);

    const session = await this.prisma.userSession.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!session) return null;
    if (!session.is_active) return null;
    if (session.expires_at < new Date()) return null;

    // Update last activity (fire-and-forget)
    this.prisma.userSession
      .update({
        where: { id: session.id },
        data: { last_activity_at: new Date() },
      })
      .catch(() => {});

    return session;
  }

  /**
   * Get all active sessions for a user.
   */
  async getUserSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { last_activity_at: 'desc' },
      select: {
        id: true,
        ip_address: true,
        is_active: true,
        last_activity_at: true,
        created_at: true,
        expires_at: true,
        device: {
          select: {
            id: true,
            device_name: true,
            device_type: true,
            browser: true,
            os: true,
            is_trusted: true,
          },
        },
      },
    });
  }

  /**
   * Revoke a specific session.
   */
  async revokeSession(userId: string, sessionId: string, reason?: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, user_id: userId, is_active: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found or already revoked');
    }

    return this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        is_active: false,
        revoked_at: new Date(),
        revoked_reason: reason || 'user_revoked',
      },
    });
  }

  /**
   * Revoke all sessions for a user except the current one.
   */
  async revokeAllSessions(
    userId: string,
    currentToken?: string,
    reason?: string,
  ) {
    const currentHash = currentToken ? this.hashToken(currentToken) : null;

    const where: Record<string, unknown> = {
      user_id: userId,
      is_active: true,
    };

    if (currentHash) {
      where.token_hash = { not: currentHash };
    }

    return this.prisma.userSession.updateMany({
      where,
      data: {
        is_active: false,
        revoked_at: new Date(),
        revoked_reason: reason || 'revoke_all',
      },
    });
  }

  /**
   * Revoke session by access token (used during logout).
   */
  async revokeByToken(accessToken: string) {
    const tokenHash = this.hashToken(accessToken);

    return this.prisma.userSession
      .updateMany({
        where: { token_hash: tokenHash, is_active: true },
        data: {
          is_active: false,
          revoked_at: new Date(),
          revoked_reason: 'logout',
        },
      })
      .catch(() => {});
  }

  /**
   * Clean up expired sessions (call periodically via cron).
   */
  async cleanupExpiredSessions() {
    const result = await this.prisma.userSession.updateMany({
      where: {
        is_active: true,
        expires_at: { lt: new Date() },
      },
      data: {
        is_active: false,
        revoked_reason: 'expired',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired sessions`);
    }

    return result;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
