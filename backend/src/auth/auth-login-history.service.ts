import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { Prisma } from '../../node_modules/.prisma/client-public';

export interface LoginAttempt {
  user_id?: string;
  email: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  login_method?: string;
  status: 'success' | 'failed' | 'blocked' | 'locked';
  failure_reason?: string;
  studio_id?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuthLoginHistoryService {
  private readonly logger = new Logger(AuthLoginHistoryService.name);

  constructor(private readonly pub: PublicPrismaService) {}

  /**
   * Record a login attempt (success or failure).
   */
  async record(attempt: LoginAttempt): Promise<void> {
    try {
      await this.pub.loginHistory.create({
        data: {
          user_id: attempt.user_id,
          email: attempt.email,
          ip_address: attempt.ip_address,
          user_agent: attempt.user_agent,
          device_id: attempt.device_id,
          login_method: attempt.login_method || 'password',
          status: attempt.status,
          failure_reason: attempt.failure_reason,
          studio_id: attempt.studio_id,
          metadata: attempt.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      // Login history is non-critical — never block authentication
      this.logger.error(`Failed to record login attempt: ${err.message}`);
    }
  }

  /**
   * Get recent login history for a user.
   */
  async getUserHistory(userId: string, limit = 50) {
    return this.pub.loginHistory.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        ip_address: true,
        login_method: true,
        status: true,
        failure_reason: true,
        created_at: true,
        device: {
          select: {
            device_name: true,
            device_type: true,
            browser: true,
            os: true,
          },
        },
      },
    });
  }

  /**
   * Get failed login count for an email within a time window.
   * Used for lockout determination.
   */
  async getRecentFailedCount(email: string, windowMinutes = 15): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.pub.loginHistory.count({
      where: {
        email,
        status: 'failed',
        created_at: { gte: since },
      },
    });
  }

  /**
   * Check if an IP has too many failed attempts (brute force detection).
   */
  async getIpFailedCount(ip: string, windowMinutes = 60): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.pub.loginHistory.count({
      where: {
        ip_address: ip,
        status: { in: ['failed', 'blocked'] },
        created_at: { gte: since },
      },
    });
  }

  /**
   * Get login history filtered by various criteria (admin use).
   */
  async getFilteredHistory(filters: {
    email?: string;
    ip_address?: string;
    status?: string;
    login_method?: string;
    from_date?: Date;
    to_date?: Date;
    limit?: number;
  }) {
    const where: Prisma.LoginHistoryWhereInput = {};

    if (filters.email) where.email = filters.email;
    if (filters.ip_address) where.ip_address = filters.ip_address;
    if (filters.status) where.status = filters.status;
    if (filters.login_method) where.login_method = filters.login_method;
    if (filters.from_date || filters.to_date) {
      where.created_at = {};
      if (filters.from_date) where.created_at.gte = filters.from_date;
      if (filters.to_date) where.created_at.lte = filters.to_date;
    }

    return this.pub.loginHistory.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: filters.limit || 100,
      select: {
        id: true,
        user_id: true,
        email: true,
        ip_address: true,
        login_method: true,
        status: true,
        failure_reason: true,
        studio_id: true,
        created_at: true,
        device: {
          select: {
            device_name: true,
            device_type: true,
            browser: true,
            os: true,
          },
        },
      },
    });
  }
}
