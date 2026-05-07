import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';
import { DashboardGateway } from './dashboard.gateway';
import { DashboardCacheService } from './dashboard-cache.service';

export interface HealthState {
  healthy: boolean;
  latency_ms?: number;
  message?: string;
}

export interface SystemStatusResponse {
  api: HealthState;
  database: HealthState;
  redis: HealthState;
  websocket: HealthState;
  scanner: HealthState;
  sync_lag_seconds: number;
  queued_webhooks: number;
  generated_at: string;
}

interface CacheEntry {
  value: SystemStatusResponse;
  expires_at: number;
}

const CACHE_TTL_MS = 10_000;

@Injectable()
export class SystemStatusService {
  private readonly logger = new Logger(SystemStatusService.name);
  private cache = new Map<string, CacheEntry>();

  constructor(
    private prisma: PrismaService,
    private gateway: DashboardGateway,
    /**
     * Reuse the dashboard's shared Redis client instead of opening a second
     * ioredis connection here. One TCP connection, one retry strategy, one
     * place to instrument.
     */
    private cacheService: DashboardCacheService,
  ) {}

  async getStatus(user: JwtPayload): Promise<SystemStatusResponse> {
    const cacheKey = user?.studio_id ?? 'global';
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires_at > now) {
      return cached.value;
    }

    const [database, redis, scanner, syncLagSeconds, queuedWebhooks] = await Promise.all([
      this.probeDatabase(),
      this.probeRedis(),
      this.probeScanner(user),
      this.measureSyncLag(),
      this.countQueuedWebhooks(user),
    ]);

    const value: SystemStatusResponse = {
      api: { healthy: true, latency_ms: 0 },
      database,
      redis,
      websocket: this.probeWebsocket(),
      scanner,
      sync_lag_seconds: syncLagSeconds,
      queued_webhooks: queuedWebhooks,
      generated_at: new Date().toISOString(),
    };

    this.cache.set(cacheKey, { value, expires_at: now + CACHE_TTL_MS });
    return value;
  }

  private async probeDatabase(): Promise<HealthState> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { healthy: true, latency_ms: Date.now() - start };
    } catch (err: any) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        message: err?.message ?? 'Database query failed',
      };
    }
  }

  private probeRedis(): Promise<HealthState> {
    // Delegate to the dashboard's shared Redis client — one TCP conn, not two.
    return this.cacheService.getRedisHealth();
  }

  private probeWebsocket(): HealthState {
    try {
      const count = this.gateway.getClientCount();
      return { healthy: true, latency_ms: 0, message: `${count} client${count === 1 ? '' : 's'} connected` };
    } catch (err: any) {
      return { healthy: false, message: err?.message ?? 'Gateway not initialised' };
    }
  }

  private async probeScanner(user: JwtPayload): Promise<HealthState> {
    const branchFilter = this.getBranchFilter(user);
    const start = Date.now();
    try {
      const last = await this.prisma.checkIn.findFirst({
        where: { status: 'success', ...branchFilter },
        select: { checked_in_at: true },
        orderBy: { checked_in_at: 'desc' },
      });

      const latency = Date.now() - start;
      if (!last) {
        return { healthy: true, latency_ms: latency, message: 'No check-ins recorded yet' };
      }

      const ageMs = Date.now() - new Date(last.checked_in_at).getTime();
      const ageHours = ageMs / 3_600_000;
      const isPeak = this.isPeakGymHour(new Date());

      if (isPeak && ageHours > 2) {
        return {
          healthy: false,
          latency_ms: latency,
          message: `No scanner activity for ${ageHours.toFixed(1)} hours`,
        };
      }

      if (ageHours > 8) {
        return {
          healthy: false,
          latency_ms: latency,
          message: `No scanner activity for ${ageHours.toFixed(1)} hours`,
        };
      }

      return {
        healthy: true,
        latency_ms: latency,
        message: `Last scan ${this.humaniseAge(ageMs)} ago`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        message: err?.message ?? 'Scanner probe failed',
      };
    }
  }

  private isPeakGymHour(now: Date): boolean {
    const hour = now.getHours();
    // Peak windows: 6–10am and 5–9pm.
    return (hour >= 6 && hour < 10) || (hour >= 17 && hour < 21);
  }

  private humaniseAge(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return 'less than a minute';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  private async measureSyncLag(): Promise<number> {
    // Wave 13 fallback: dashboard_projections table is not yet built.
    // Use the most recent successful check-in or payment as the lag cursor —
    // when projections wave lands, swap to read `dashboard_projections.updated_at`.
    try {
      const [ci, py] = await Promise.all([
        this.prisma.checkIn.findFirst({
          select: { checked_in_at: true },
          orderBy: { checked_in_at: 'desc' },
        }),
        this.prisma.payment.findFirst({
          select: { paid_at: true },
          orderBy: { paid_at: 'desc' },
        }),
      ]);
      const cursor = Math.max(
        ci?.checked_in_at ? new Date(ci.checked_in_at).getTime() : 0,
        py?.paid_at ? new Date(py.paid_at).getTime() : 0,
      );
      if (!cursor) return 0;
      return Math.max(0, Math.round((Date.now() - cursor) / 1000));
    } catch {
      return 0;
    }
  }

  private async countQueuedWebhooks(user: JwtPayload): Promise<number> {
    try {
      const where: any = { status: 'pending' };
      if (user?.studio_id) {
        where.webhook = { organization_id: user.studio_id };
      }
      return await this.prisma.webhookDelivery.count({ where });
    } catch {
      return 0;
    }
  }

  private getBranchFilter(user?: JwtPayload) {
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

}
