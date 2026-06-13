import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { CreateRegionDto, UpdateRegionDto } from './dto';

@Injectable()
export class RegionService {
  constructor(private tenant: TenantPrisma) {}

  async findAll(filters?: { organization_id?: string; is_active?: boolean }) {
    const where: Record<string, unknown> = {};
    if (filters?.organization_id) where.organization_id = filters.organization_id;
    if (filters?.is_active !== undefined) where.is_active = filters.is_active;

    return this.tenant.client.region.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { branches: true } },
      },
    });
  }

  async findOne(id: string) {
    const region = await this.tenant.client.region.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        branches: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true, city: true, status: true },
        },
        _count: { select: { branches: true } },
      },
    });
    if (!region) throw new NotFoundException('Region not found');
    return region;
  }

  async create(dto: CreateRegionDto) {
    // Verify organization exists
    const org = await this.tenant.client.organization.findUnique({
      where: { id: dto.organization_id },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const region = await this.tenant.client.region.create({
      data: {
        gym_id: getTenantGymId()!,
        organization_id: dto.organization_id,
        name: dto.name,
        country: dto.country,
        timezone: dto.timezone,
        manager_id: dto.manager_id,
      },
    });
    return this.findOne(region.id);
  }

  async update(id: string, dto: UpdateRegionDto) {
    const existing = await this.tenant.client.region.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Region not found');

    await this.tenant.client.region.update({ where: { id }, data: dto });
    return this.findOne(id);
  }

  async deactivate(id: string) {
    const existing = await this.tenant.client.region.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Region not found');

    return this.tenant.client.region.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
