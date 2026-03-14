import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { UpdateBranchSettingsDto } from '../organization/dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    user?: JwtPayload,
    filters?: {
      organization_id?: string;
      region_id?: string;
      status?: string;
    },
  ) {
    const where: Record<string, unknown> = {};

    // Non-owner users only see their assigned branches
    if (user && user.role !== 'owner' && user.role !== 'brand_owner' && user.branch_ids?.length > 0) {
      where.id = { in: user.branch_ids };
    }

    if (filters?.organization_id) where.organization_id = filters.organization_id;
    if (filters?.region_id) where.region_id = filters.region_id;
    if (filters?.status) where.status = filters.status;

    return this.prisma.branch.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        region: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        region: { select: { id: true, name: true } },
        settings: true,
        _count: { select: { members: true, classes: true, expenses: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(data: CreateBranchDto) {
    // Validate organization exists if provided
    if (data.organization_id) {
      const org = await this.prisma.organization.findUnique({
        where: { id: data.organization_id },
      });
      if (!org) throw new NotFoundException('Organization not found');
    }

    // Validate region exists and belongs to organization if provided
    if (data.region_id) {
      const region = await this.prisma.region.findUnique({
        where: { id: data.region_id },
      });
      if (!region) throw new NotFoundException('Region not found');
      if (data.organization_id && region.organization_id !== data.organization_id) {
        throw new NotFoundException('Region does not belong to the specified organization');
      }
    }

    const branch = await this.prisma.branch.create({
      data: {
        name: data.name,
        organization_id: data.organization_id,
        region_id: data.region_id,
        code: data.code,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postal_code: data.postal_code,
        latitude: data.latitude,
        longitude: data.longitude,
        phone: data.phone,
        email: data.email,
        status: data.status ?? 'active',
        opening_time: data.opening_time,
        closing_time: data.closing_time,
      },
    });

    return this.findOne(branch.id);
  }

  async update(id: string, data: UpdateBranchDto) {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Branch not found');

    // Validate organization if being changed
    if (data.organization_id) {
      const org = await this.prisma.organization.findUnique({
        where: { id: data.organization_id },
      });
      if (!org) throw new NotFoundException('Organization not found');
    }

    // Validate region if being changed
    if (data.region_id) {
      const region = await this.prisma.region.findUnique({
        where: { id: data.region_id },
      });
      if (!region) throw new NotFoundException('Region not found');
    }

    await this.prisma.branch.update({ where: { id }, data });
    return this.findOne(id);
  }

  async deactivate(id: string) {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Branch not found');
    return this.prisma.branch.update({
      where: { id },
      data: { is_active: false, status: 'inactive' },
    });
  }

  // ── Branch Settings ───────────────────────────────────────────

  async getSettings(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const settings = await this.prisma.branchSettings.findUnique({
      where: { branch_id: branchId },
    });
    if (!settings) throw new NotFoundException('Branch settings not found');
    return settings;
  }

  async updateSettings(branchId: string, dto: UpdateBranchSettingsDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.branchSettings.upsert({
      where: { branch_id: branchId },
      update: {
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.tax_percentage !== undefined && { tax_percentage: dto.tax_percentage }),
        ...(dto.membership_policy !== undefined && { membership_policy: dto.membership_policy }),
        ...(dto.checkin_policy !== undefined && { checkin_policy: dto.checkin_policy }),
        ...(dto.notification_prefs !== undefined && { notification_prefs: dto.notification_prefs }),
      },
      create: {
        branch_id: branchId,
        currency: dto.currency ?? 'INR',
        tax_percentage: dto.tax_percentage ?? 0,
        membership_policy: dto.membership_policy ?? {},
        checkin_policy: dto.checkin_policy ?? {},
        notification_prefs: dto.notification_prefs ?? {},
      },
    });
  }
}
