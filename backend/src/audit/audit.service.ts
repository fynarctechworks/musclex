import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    user_id: string;
    action: string;
    module: string;
    entity_id?: string;
    entity_type?: string;
    details?: Record<string, unknown>;
    ip_address?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        user_id: params.user_id,
        action: params.action,
        module: params.module,
        entity_id: params.entity_id,
        entity_type: params.entity_type,
        details: params.details as Prisma.InputJsonValue | undefined,
        ip_address: params.ip_address,
      },
    });
  }

  async findByModule(module: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { module },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async findByUser(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async findRecent(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
