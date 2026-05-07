import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import { AuditAction, Prisma, TenantStatus } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import {
  CreateTenantDto,
  UpdateTenantDto,
  ChangeTenantPlanDto,
  TenantFilterDto,
} from './dto/tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
  ) {}

  async findAll(filters: TenantFilterDto) {
    const where: Prisma.TenantWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.plan_id) where.plan_id = filters.plan_id;
    if (filters.is_active !== undefined) where.is_active = filters.is_active;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { owner_email: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Whitelist allowed sort fields to prevent SQL injection via dynamic field names
    const ALLOWED_SORT_FIELDS = ['created_at', 'name', 'status', 'owner_email', 'updated_at'];
    const sortField = ALLOWED_SORT_FIELDS.includes(filters.sort_by ?? '')
      ? filters.sort_by
      : 'created_at';
    const orderBy: Prisma.TenantOrderByWithRelationInput = {
      [sortField!]: filters.sort_order || 'desc',
    };

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          plan: { select: { id: true, name: true, price_monthly: true } },
          _count: { select: { subscriptions: true, payments: true } },
        },
        orderBy,
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return new PaginatedResult(data, total, filters.page!, filters.limit!);
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        subscriptions: { orderBy: { created_at: 'desc' }, take: 5 },
        payments: { orderBy: { created_at: 'desc' }, take: 10 },
        feature_flags: { include: { flag: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  /** Call-center search: find tenant by ID (UUID) or slug */
  async findByIdOrSlug(query: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const where = uuidRegex.test(query) ? { id: query } : { slug: query };

    const tenant = await this.prisma.tenant.findUnique({
      where,
      include: {
        plan: true,
        subscriptions: { orderBy: { created_at: 'desc' }, take: 3 },
        payments: { orderBy: { created_at: 'desc' }, take: 5 },
      },
    });
    if (!tenant) throw new NotFoundException(`No gym found for "${query}"`);
    return tenant;
  }

  async create(dto: CreateTenantDto, ctx: AuditContext) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already taken');

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14-day trial

    const tenant = await this.prisma.tenant.create({
      data: {
        ...dto,
        trial_ends_at: trialEndsAt,
      },
      include: { plan: true },
    });

    // Create trial subscription if a plan is assigned
    if (dto.plan_id) {
      await this.prisma.subscription.create({
        data: {
          tenant_id: tenant.id,
          plan_id: dto.plan_id,
          status: 'TRIALING',
          start_date: new Date(),
          end_date: trialEndsAt,
        },
      });
    }

    await this.audit.log(AuditAction.CREATE, 'tenant', tenant.id, ctx, {
      new_value: { name: tenant.name, slug: tenant.slug },
    });

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, ctx: AuditContext) {
    const tenant = await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: dto,
      include: { plan: true },
    });

    await this.audit.log(AuditAction.UPDATE, 'tenant', id, ctx, {
      old_value: dto, // simplified diff
      new_value: updated,
    });

    return updated;
  }

  async changePlan(id: string, dto: ChangeTenantPlanDto, ctx: AuditContext) {
    const tenant = await this.findOne(id);

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.plan_id },
    });
    if (!plan || !plan.is_active) {
      throw new BadRequestException('Invalid or inactive plan');
    }

    const oldPlanId = tenant.plan_id;

    // Update tenant plan + cancel old subs + create new subscription in a transaction
    const [updatedTenant, _cancelledSubs, subscription] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id },
        data: {
          plan_id: dto.plan_id,
          status: TenantStatus.ACTIVE,
          max_members: (plan.limits as any)?.max_members ?? tenant.max_members,
          max_branches: (plan.limits as any)?.max_branches ?? tenant.max_branches,
          max_staff: (plan.limits as any)?.max_staff ?? tenant.max_staff,
        },
      }),
      this.prisma.subscription.updateMany({
        where: { tenant_id: id, status: { in: ['ACTIVE', 'TRIALING'] } },
        data: { status: 'CANCELED', canceled_at: new Date() },
      }),
      this.prisma.subscription.create({
        data: {
          tenant_id: id,
          plan_id: dto.plan_id,
          status: 'ACTIVE',
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    await this.audit.log(AuditAction.PLAN_CHANGE, 'tenant', id, ctx, {
      old_value: { plan_id: oldPlanId },
      new_value: { plan_id: dto.plan_id },
    });

    return { tenant: updatedTenant, subscription };
  }

  async suspend(id: string, ctx: AuditContext) {
    await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.SUSPENDED, is_active: false },
    });

    await this.audit.log(AuditAction.SUSPEND, 'tenant', id, ctx);
    return updated;
  }

  async activate(id: string, ctx: AuditContext) {
    await this.findOne(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.ACTIVE, is_active: true },
    });

    await this.audit.log(AuditAction.ACTIVATE, 'tenant', id, ctx);
    return updated;
  }
}
