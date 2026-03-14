import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateOrganizationSettingsDto } from './dto';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  // ── Organization CRUD ─────────────────────────────────────────

  async findAll(filters?: { status?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;

    return this.prisma.organization.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { regions: true, branches: true, franchise_owners: true } },
      },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        settings: true,
        regions: { where: { is_active: true }, orderBy: { name: 'asc' } },
        _count: { select: { branches: true, regions: true, franchise_owners: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async findBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      include: {
        settings: true,
        _count: { select: { branches: true, regions: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(dto: CreateOrganizationDto) {
    const slug = this.generateSlug(dto.name);

    const existing = await this.prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Organization slug '${slug}' already exists`);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          logo_url: dto.logo_url,
          industry_type: dto.industry_type ?? 'fitness',
          country: dto.country,
          timezone: dto.timezone ?? 'Asia/Kolkata',
          currency: dto.currency ?? 'INR',
        },
      });

      // Auto-create default settings
      await tx.organizationSettings.create({
        data: {
          organization_id: org.id,
          default_timezone: dto.timezone ?? 'Asia/Kolkata',
          default_currency: dto.currency ?? 'INR',
        },
      });

      return this.findOne(org.id);
    });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Organization not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = this.generateSlug(dto.name);
      // Check slug uniqueness
      const slugConflict = await this.prisma.organization.findFirst({
        where: { slug: data.slug as string, id: { not: id } },
      });
      if (slugConflict) throw new ConflictException(`Organization slug already exists`);
    }
    if (dto.logo_url !== undefined) data.logo_url = dto.logo_url;
    if (dto.industry_type !== undefined) data.industry_type = dto.industry_type;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.status !== undefined) data.status = dto.status;

    await this.prisma.organization.update({ where: { id }, data });
    return this.findOne(id);
  }

  // ── Organization Settings ─────────────────────────────────────

  async getSettings(organizationId: string) {
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organization_id: organizationId },
    });
    if (!settings) throw new NotFoundException('Organization settings not found');
    return settings;
  }

  async updateSettings(organizationId: string, dto: UpdateOrganizationSettingsDto) {
    // Ensure organization exists
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    return this.prisma.organizationSettings.upsert({
      where: { organization_id: organizationId },
      update: {
        ...(dto.default_timezone !== undefined && { default_timezone: dto.default_timezone }),
        ...(dto.default_currency !== undefined && { default_currency: dto.default_currency }),
        ...(dto.billing_plan !== undefined && { billing_plan: dto.billing_plan }),
        ...(dto.feature_flags !== undefined && { feature_flags: dto.feature_flags }),
        ...(dto.branding !== undefined && { branding: dto.branding }),
      },
      create: {
        organization_id: organizationId,
        default_timezone: dto.default_timezone ?? org.timezone,
        default_currency: dto.default_currency ?? org.currency,
        billing_plan: dto.billing_plan,
        feature_flags: dto.feature_flags ?? {},
        branding: dto.branding ?? {},
      },
    });
  }

  // ── Organization Hierarchy Stats ──────────────────────────────

  async getHierarchy(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        regions: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
          include: {
            branches: {
              where: { is_active: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true, code: true, city: true, status: true },
            },
          },
        },
        branches: {
          where: { is_active: true, region_id: null },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true, city: true, status: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // ── Helpers ───────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
