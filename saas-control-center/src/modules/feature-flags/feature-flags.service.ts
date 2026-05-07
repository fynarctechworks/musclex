import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction } from '@prisma/client';
import { REDIS_CLIENT } from '../../config/redis.module';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  SetPlanFlagDto,
  SetTenantFlagDto,
} from './dto/feature-flags.dto';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class FeatureFlagsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async findAll() {
    return this.prisma.featureFlag.findMany({
      include: {
        plan_flags: { include: { plan: { select: { id: true, name: true } } } },
        tenant_flags: { include: { tenant: { select: { id: true, name: true } } } },
      },
      orderBy: { key: 'asc' },
    });
  }

  async create(dto: CreateFeatureFlagDto, ctx: AuditContext) {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key: dto.key },
    });
    if (existing) throw new ConflictException('Feature flag key already exists');

    const flag = await this.prisma.featureFlag.create({ data: dto });

    await this.audit.log(AuditAction.FEATURE_TOGGLE, 'feature_flag', flag.id, ctx, {
      new_value: flag,
    });

    return flag;
  }

  async update(id: string, dto: UpdateFeatureFlagDto, ctx: AuditContext) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: dto,
    });

    await this.invalidateCache();

    await this.audit.log(AuditAction.FEATURE_TOGGLE, 'feature_flag', id, ctx, {
      old_value: { is_global: flag.is_global },
      new_value: dto,
    });

    return updated;
  }

  async setPlanFlag(dto: SetPlanFlagDto, ctx: AuditContext) {
    const result = await this.prisma.planFeatureFlag.upsert({
      where: {
        plan_id_flag_id: { plan_id: dto.plan_id, flag_id: dto.flag_id },
      },
      create: {
        plan_id: dto.plan_id,
        flag_id: dto.flag_id,
        enabled: dto.enabled,
      },
      update: { enabled: dto.enabled },
    });

    await this.invalidateCache();

    await this.audit.log(AuditAction.FEATURE_TOGGLE, 'plan_feature_flag', result.id, ctx, {
      new_value: dto,
    });

    return result;
  }

  async setTenantFlag(dto: SetTenantFlagDto, ctx: AuditContext) {
    const result = await this.prisma.tenantFeatureFlag.upsert({
      where: {
        tenant_id_flag_id: { tenant_id: dto.tenant_id, flag_id: dto.flag_id },
      },
      create: {
        tenant_id: dto.tenant_id,
        flag_id: dto.flag_id,
        enabled: dto.enabled,
      },
      update: { enabled: dto.enabled },
    });

    await this.invalidateCache();

    await this.audit.log(AuditAction.FEATURE_TOGGLE, 'tenant_feature_flag', result.id, ctx, {
      new_value: dto,
    });

    return result;
  }

  /**
   * Resolves feature flags for a tenant.
   * Priority: tenant override > plan override > global default
   */
  async resolveForTenant(tenantId: string): Promise<Record<string, boolean>> {
    const cacheKey = `ff:tenant:${tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan_id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const allFlags = await this.prisma.featureFlag.findMany({
      include: {
        plan_flags: {
          where: tenant.plan_id ? { plan_id: tenant.plan_id } : { plan_id: 'none' },
        },
        tenant_flags: { where: { tenant_id: tenantId } },
      },
    });

    const resolved: Record<string, boolean> = {};

    for (const flag of allFlags) {
      // Priority: tenant > plan > global
      const tenantOverride = flag.tenant_flags[0];
      if (tenantOverride !== undefined) {
        resolved[flag.key] = tenantOverride.enabled;
        continue;
      }

      const planOverride = flag.plan_flags[0];
      if (planOverride !== undefined) {
        resolved[flag.key] = planOverride.enabled;
        continue;
      }

      resolved[flag.key] = flag.is_global;
    }

    await this.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(resolved));
    return resolved;
  }

  private async invalidateCache() {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor, 'MATCH', 'ff:*', 'COUNT', 100,
      );
      cursor = nextCursor;
      if (keys.length > 0) await this.redis.del(...keys);
    } while (cursor !== '0');
  }
}
