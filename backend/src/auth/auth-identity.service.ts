import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';

/**
 * Manages the local UserIdentity table that mirrors Supabase Auth users.
 * This provides fast local queries for:
 * - Login lockout tracking (persistent, not in-memory)
 * - Device associations
 * - Session management
 * - User profile data that doesn't need to live in Supabase metadata
 */
@Injectable()
export class AuthIdentityService {
  private readonly logger = new Logger(AuthIdentityService.name);

  constructor(private readonly pub: PublicPrismaService) {}

  /**
   * Sync a Supabase user to the local identity table.
   * Called on every successful login to keep data fresh.
   */
  async syncIdentity(params: {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    email_verified?: boolean;
  }) {
    try {
      const existing = await this.pub.userIdentity.findUnique({
        where: { id: params.id },
      });

      if (existing) {
        return this.pub.userIdentity.update({
          where: { id: params.id },
          data: {
            email: params.email,
            full_name: params.full_name,
            phone: params.phone ?? existing.phone,
            avatar_url: params.avatar_url ?? existing.avatar_url,
            email_verified: params.email_verified ?? existing.email_verified,
            last_login_at: new Date(),
            login_count: { increment: 1 },
            failed_login_count: 0, // Reset on successful login
            locked_until: null,
          },
        });
      }

      return this.pub.userIdentity.create({
        data: {
          id: params.id,
          email: params.email,
          full_name: params.full_name,
          phone: params.phone,
          avatar_url: params.avatar_url,
          email_verified: params.email_verified ?? false,
          last_login_at: new Date(),
          login_count: 1,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to sync identity for ${params.email}: ${err.message}`);
      return null;
    }
  }

  /**
   * Record a failed login attempt. Handles lockout logic.
   * Returns lockout info if the account should be locked.
   */
  async recordFailedLogin(
    email: string,
    maxAttempts = 5,
    lockoutMinutes = 15,
  ): Promise<{
    is_locked: boolean;
    locked_until?: Date;
    remaining_attempts: number;
  }> {
    const identity = await this.pub.userIdentity.findUnique({
      where: { email },
    });

    if (!identity) {
      // User doesn't exist locally yet — return generic response
      return { is_locked: false, remaining_attempts: maxAttempts - 1 };
    }

    const newFailedCount = identity.failed_login_count + 1;

    if (newFailedCount >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      await this.pub.userIdentity.update({
        where: { id: identity.id },
        data: {
          failed_login_count: 0,
          locked_until: lockedUntil,
        },
      });
      return { is_locked: true, locked_until: lockedUntil, remaining_attempts: 0 };
    }

    await this.pub.userIdentity.update({
      where: { id: identity.id },
      data: { failed_login_count: newFailedCount },
    });

    return {
      is_locked: false,
      remaining_attempts: maxAttempts - newFailedCount,
    };
  }

  /**
   * Check if a user account is currently locked.
   */
  async isAccountLocked(email: string): Promise<{
    locked: boolean;
    locked_until?: Date;
    minutes_remaining?: number;
  }> {
    const identity = await this.pub.userIdentity.findUnique({
      where: { email },
    });

    if (!identity || !identity.locked_until) {
      return { locked: false };
    }

    if (identity.locked_until > new Date()) {
      const minutesRemaining = Math.ceil(
        (identity.locked_until.getTime() - Date.now()) / 60000,
      );
      return {
        locked: true,
        locked_until: identity.locked_until,
        minutes_remaining: minutesRemaining,
      };
    }

    // Lock expired — clear it
    await this.pub.userIdentity.update({
      where: { id: identity.id },
      data: { locked_until: null, failed_login_count: 0 },
    });

    return { locked: false };
  }

  /**
   * Get user identity by ID.
   */
  async getIdentity(userId: string) {
    return this.pub.userIdentity.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        avatar_url: true,
        status: true,
        email_verified: true,
        phone_verified: true,
        last_login_at: true,
        login_count: true,
        two_factor_enabled: true,
        two_factor_method: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  /**
   * Suspend a user account.
   */
  async suspendUser(userId: string) {
    return this.pub.userIdentity.update({
      where: { id: userId },
      data: { status: 'suspended' },
    });
  }

  /**
   * Reactivate a suspended user.
   */
  async reactivateUser(userId: string) {
    return this.pub.userIdentity.update({
      where: { id: userId },
      data: { status: 'active', locked_until: null, failed_login_count: 0 },
    });
  }
}
