import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto, CreateLeadActivityDto } from './dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: dto,
      include: {
        branch: { select: { id: true, name: true } },
        assigned_staff: { select: { id: true, full_name: true } },
      },
    });

    // Log creation activity
    await this.prisma.leadActivity.create({
      data: {
        lead_id: lead.id,
        staff_id: dto.assigned_staff_id,
        activity_type: 'note',
        notes: 'Lead created',
      },
    });

    return lead;
  }

  async findAll(filters: {
    organization_id?: string;
    branch_id?: string;
    status?: string;
    lead_source?: string;
    assigned_staff_id?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      organization_id, branch_id, status, lead_source,
      assigned_staff_id, search, page = 1, limit = 50,
    } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (organization_id) where.organization_id = organization_id;
    if (branch_id) where.branch_id = branch_id;
    if (status) where.status = status;
    if (lead_source) where.lead_source = lead_source;
    if (assigned_staff_id) where.assigned_staff_id = assigned_staff_id;
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
          assigned_staff: { select: { id: true, full_name: true } },
          _count: { select: { activities: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        assigned_staff: { select: { id: true, full_name: true } },
        converted_member: { select: { id: true, full_name: true } },
        activities: {
          orderBy: { created_at: 'desc' },
          take: 20,
          include: { staff: { select: { id: true, full_name: true } } },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Log status change
    if (dto.status && dto.status !== lead.status) {
      await this.prisma.leadActivity.create({
        data: {
          lead_id: id,
          activity_type: 'status_change',
          notes: `Status changed from ${lead.status} to ${dto.status}`,
        },
      });
    }

    return this.prisma.lead.update({
      where: { id },
      data: dto,
      include: {
        branch: { select: { id: true, name: true } },
        assigned_staff: { select: { id: true, full_name: true } },
      },
    });
  }

  async addActivity(dto: CreateLeadActivityDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id: dto.lead_id } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.leadActivity.create({
      data: dto,
      include: { staff: { select: { id: true, full_name: true } } },
    });
  }

  async getActivities(leadId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.leadActivity.findMany({
        where: { lead_id: leadId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { staff: { select: { id: true, full_name: true } } },
      }),
      this.prisma.leadActivity.count({ where: { lead_id: leadId } }),
    ]);
    return { data, total, page, limit };
  }

  async getFunnelAnalytics(filters: {
    organization_id?: string;
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const { organization_id, branch_id, start_date, end_date } = filters;
    const where: any = {};

    if (organization_id) where.organization_id = organization_id;
    if (branch_id) where.branch_id = branch_id;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [totalLeads, byStatus, bySource] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ['lead_source'],
        where,
        _count: { id: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) statusMap[s.status] = s._count.id;

    const sourceMap: Record<string, number> = {};
    for (const s of bySource) sourceMap[s.lead_source] = s._count.id;

    const converted = statusMap['converted'] ?? 0;
    const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;

    return {
      total_leads: totalLeads,
      by_status: statusMap,
      by_source: sourceMap,
      conversion_rate: Math.round(conversionRate * 100) / 100,
      funnel: {
        new: statusMap['new'] ?? 0,
        contacted: statusMap['contacted'] ?? 0,
        trial_scheduled: statusMap['trial_scheduled'] ?? 0,
        converted,
        lost: statusMap['lost'] ?? 0,
      },
    };
  }
}
