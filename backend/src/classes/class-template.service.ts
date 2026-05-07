import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassTemplateDto, UpdateClassTemplateDto } from './dto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class ClassTemplateService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClassTemplateDto) {
    return this.prisma.classTemplate.create({
      data: {
        gym_id: getTenantGymId()!,
        organization_id: dto.organization_id,
        branch_id: dto.branch_id,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        default_duration_minutes: dto.default_duration_minutes ?? 60,
        default_capacity: dto.default_capacity ?? 20,
        created_by_id: dto.created_by_id,
      },
      include: {
        branch: { select: { id: true, name: true } },
        created_by: { select: { id: true, full_name: true } },
      },
    });
  }

  async findAll(filters?: {
    branch_id?: string;
    organization_id?: string;
    category?: string;
    is_active?: boolean;
  }) {
    const where: any = {};
    if (filters?.branch_id) where.branch_id = filters.branch_id;
    if (filters?.organization_id) where.organization_id = filters.organization_id;
    if (filters?.category) where.category = filters.category;
    if (filters?.is_active !== undefined) where.is_active = filters.is_active;

    return this.prisma.classTemplate.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        created_by: { select: { id: true, full_name: true } },
        _count: { select: { sessions: true, recurring_rules: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.classTemplate.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        created_by: { select: { id: true, full_name: true } },
        recurring_rules: true,
        _count: { select: { sessions: true } },
      },
    });
    if (!template) throw new NotFoundException('Class template not found');
    return template;
  }

  async update(id: string, dto: UpdateClassTemplateDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.default_duration_minutes !== undefined) data.default_duration_minutes = dto.default_duration_minutes;
    if (dto.default_capacity !== undefined) data.default_capacity = dto.default_capacity;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    return this.prisma.classTemplate.update({
      where: { id },
      data,
      include: {
        branch: { select: { id: true, name: true } },
        created_by: { select: { id: true, full_name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.classTemplate.update({
      where: { id },
      data: { is_active: false },
    });
    return { success: true };
  }
}
