import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

export interface AuditContext {
  admin_id: string;
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async log(
    action: AuditAction,
    entity_type: string,
    entity_id: string | null,
    context: AuditContext,
    options?: { old_value?: any; new_value?: any; metadata?: any },
  ) {
    return this.prisma.auditLog.create({
      data: {
        action,
        entity_type,
        entity_id,
        admin_id: context.admin_id,
        ip_address: context.ip_address,
        user_agent: context.user_agent,
        old_value: options?.old_value ?? Prisma.JsonNull,
        new_value: options?.new_value ?? Prisma.JsonNull,
        metadata: options?.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async findAll(
    pagination: PaginationDto,
    filters?: {
      action?: AuditAction;
      entity_type?: string;
      entity_id?: string;
      admin_id?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.action) where.action = filters.action;
    if (filters?.entity_type) where.entity_type = filters.entity_type;
    if (filters?.entity_id) where.entity_id = filters.entity_id;
    if (filters?.admin_id) where.admin_id = filters.admin_id;
    if (filters?.from || filters?.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = filters.from;
      if (filters.to) where.created_at.lte = filters.to;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { admin: { select: { id: true, email: true, name: true } } },
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return new PaginatedResult(data, total, pagination.page!, pagination.limit!);
  }
}
