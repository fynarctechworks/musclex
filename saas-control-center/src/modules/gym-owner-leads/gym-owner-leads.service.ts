import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateGymOwnerLeadDto,
  ListGymOwnerLeadsDto,
  UpdateGymOwnerLeadDto,
} from './dto/gym-owner-leads.dto';

/**
 * Enquiries from gym owners submitted on the public marketing website.
 *
 * Distinct from the member-app "Leads" surface, which lists registered consumer
 * app users who have not joined a gym yet. These are prospective TENANTS.
 */
@Injectable()
export class GymOwnerLeadsService {
  private readonly logger = new Logger(GymOwnerLeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ingest from the marketing site. Never throws on duplicate submissions. */
  async create(dto: CreateGymOwnerLeadDto) {
    const lead = await this.prisma.gymOwnerLead.create({
      data: {
        name: dto.name.trim(),
        studio_name: dto.studio_name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone.trim(),
        branches: dto.branches?.trim() || null,
        topic: dto.topic?.trim() || null,
        message: dto.message.trim(),
        source: dto.source?.trim() || 'marketing_contact',
        user_agent: dto.user_agent?.slice(0, 400) || null,
      },
      select: { id: true, created_at: true },
    });

    // Log the id only. The body carries prospect PII and this logger ships to
    // the platform log stream.
    this.logger.log(`Gym owner lead received: ${lead.id}`);
    return lead;
  }

  async findAll(query: ListGymOwnerLeadsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const search = query.search?.trim();

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { studio_name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [data, total, statusCounts] = await Promise.all([
      this.prisma.gymOwnerLead.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.gymOwnerLead.count({ where }),
      // Drives the status filter chips, so it counts across ALL leads rather
      // than the current filter.
      this.prisma.gymOwnerLead.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        statusCounts: Object.fromEntries(
          statusCounts.map((s) => [s.status, s._count._all]),
        ) as Record<string, number>,
      },
    };
  }

  async findOne(id: string) {
    const lead = await this.prisma.gymOwnerLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: UpdateGymOwnerLeadDto) {
    await this.findOne(id);
    return this.prisma.gymOwnerLead.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.gymOwnerLead.delete({ where: { id } });
    return { deleted: true };
  }
}
