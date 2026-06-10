import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ErrorStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PaginatedResult } from '../../../common/dto/pagination.dto';
import { QueryErrorsDto } from '../dto/query-errors.dto';
import { UpdateErrorDto, BulkResolveDto } from '../dto/update-error.dto';
import { ErrorStats } from '../types/monitoring.types';

const ACTIVE_STATUSES: ErrorStatus[] = [
  ErrorStatus.OPEN,
  ErrorStatus.INVESTIGATING,
  ErrorStatus.REOPENED,
];

const SORTABLE = new Set([
  'last_seen_at',
  'first_seen_at',
  'occurrence_count',
  'severity',
  'created_at',
]);

@Injectable()
export class ErrorQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryErrorsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.SystemErrorWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.source) where.source = query.source;
    if (query.environment) where.environment = query.environment;
    if (query.module) where.module = query.module;
    if (query.tenant_id) {
      where.occurrences = { some: { tenant_id: query.tenant_id } };
    }
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { message: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.from || query.to) {
      where.last_seen_at = {};
      if (query.from) where.last_seen_at.gte = new Date(query.from);
      if (query.to) where.last_seen_at.lte = new Date(query.to);
    }

    const sortBy = SORTABLE.has(query.sort_by ?? '')
      ? (query.sort_by as string)
      : 'last_seen_at';
    const orderBy = { [sortBy]: query.sort_order ?? 'desc' };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.systemError.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: limit,
        include: { release: { select: { version: true, app: true } } },
      }),
      this.prisma.systemError.count({ where }),
    ]);

    return new PaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const error = await this.prisma.systemError.findUnique({
      where: { id },
      include: {
        release: true,
        occurrences: { orderBy: { occurred_at: 'desc' }, take: 25 },
        activities: { orderBy: { created_at: 'desc' }, take: 100 },
        alerts: { orderBy: { created_at: 'desc' }, take: 20 },
      },
    });
    if (!error) throw new NotFoundException(`System error ${id} not found`);
    return error;
  }

  async stats(): Promise<ErrorStats> {
    const [
      total_errors,
      critical_errors,
      active_issues,
      api_failures,
      frontend_crashes,
      database_errors,
      resolved_issues,
      severityGroups,
      trendRows,
    ] = await Promise.all([
      this.prisma.systemError.count(),
      this.prisma.systemError.count({
        where: { severity: 'CRITICAL', status: { in: ACTIVE_STATUSES } },
      }),
      this.prisma.systemError.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      this.prisma.systemError.count({ where: { source: { in: ['API', 'BACKEND'] } } }),
      this.prisma.systemError.count({ where: { source: 'FRONTEND' } }),
      this.prisma.systemError.count({ where: { source: 'DATABASE' } }),
      this.prisma.systemError.count({ where: { status: 'RESOLVED' } }),
      this.prisma.systemError.groupBy({ by: ['severity'], _count: { _all: true } }),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(Prisma.sql`
        SELECT date_trunc('day', occurred_at) AS day, COUNT(*)::bigint AS count
          FROM scc.error_occurrences
         WHERE occurred_at >= NOW() - INTERVAL '14 days'
         GROUP BY day
         ORDER BY day ASC
      `),
    ]);

    return {
      cards: {
        total_errors,
        critical_errors,
        active_issues,
        api_failures,
        frontend_crashes,
        database_errors,
        resolved_issues,
      },
      by_severity: severityGroups.map((g) => ({
        severity: g.severity,
        count: g._count._all,
      })),
      trend: trendRows.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
    };
  }

  async update(id: string, dto: UpdateErrorDto, adminId?: string) {
    const existing = await this.prisma.systemError.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`System error ${id} not found`);

    const data: Prisma.SystemErrorUpdateInput = {};
    const activities: Prisma.ErrorActivityLogCreateManyInput[] = [];

    if (dto.status && dto.status !== existing.status) {
      data.status = dto.status;
      activities.push({
        error_id: id,
        admin_id: adminId,
        action: 'STATUS_CHANGE',
        from_value: existing.status,
        to_value: dto.status,
      });
      if (dto.status === ErrorStatus.RESOLVED) {
        data.resolved_at = new Date();
        data.resolved_by = adminId;
      }
    }

    if (dto.severity && dto.severity !== existing.severity) {
      data.severity = dto.severity;
      activities.push({
        error_id: id,
        admin_id: adminId,
        action: 'SEVERITY_CHANGE',
        from_value: existing.severity,
        to_value: dto.severity,
      });
    }

    if (dto.assigned_to !== undefined && dto.assigned_to !== existing.assigned_to) {
      data.assigned_to = dto.assigned_to;
      activities.push({
        error_id: id,
        admin_id: adminId,
        action: 'ASSIGN',
        from_value: existing.assigned_to ?? undefined,
        to_value: dto.assigned_to,
      });
    }

    if (dto.resolution_note !== undefined) {
      data.resolution_note = dto.resolution_note;
      activities.push({
        error_id: id,
        admin_id: adminId,
        action: 'NOTE',
        note: dto.resolution_note,
      });
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.systemError.update({ where: { id }, data }),
      this.prisma.errorActivityLog.createMany({ data: activities }),
    ]);

    return updated;
  }

  async bulkResolve(dto: BulkResolveDto, adminId?: string) {
    const now = new Date();
    const [result] = await this.prisma.$transaction([
      this.prisma.systemError.updateMany({
        where: { id: { in: dto.ids } },
        data: { status: ErrorStatus.RESOLVED, resolved_at: now, resolved_by: adminId },
      }),
      this.prisma.errorActivityLog.createMany({
        data: dto.ids.map((id) => ({
          error_id: id,
          admin_id: adminId,
          action: 'BULK_RESOLVE',
          to_value: ErrorStatus.RESOLVED,
          note: dto.resolution_note,
        })),
      }),
    ]);

    return { resolved: result.count };
  }
}
