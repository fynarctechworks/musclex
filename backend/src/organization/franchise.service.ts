import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFranchiseOwnerDto,
  UpdateFranchiseOwnerDto,
  CreateBranchFranchiseDto,
} from './dto';

@Injectable()
export class FranchiseService {
  constructor(private prisma: PrismaService) {}

  // ── Franchise Owner CRUD ──────────────────────────────────────

  async findAllOwners(filters?: { organization_id?: string; is_active?: boolean }) {
    const where: Record<string, unknown> = {};
    if (filters?.organization_id) where.organization_id = filters.organization_id;
    if (filters?.is_active !== undefined) where.is_active = filters.is_active;

    return this.prisma.franchiseOwner.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { branch_franchises: true } },
      },
    });
  }

  async findOneOwner(id: string) {
    const owner = await this.prisma.franchiseOwner.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        branch_franchises: {
          include: {
            branch: { select: { id: true, name: true, code: true, city: true } },
          },
        },
      },
    });
    if (!owner) throw new NotFoundException('Franchise owner not found');
    return owner;
  }

  async createOwner(dto: CreateFranchiseOwnerDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organization_id },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const owner = await this.prisma.franchiseOwner.create({
      data: {
        organization_id: dto.organization_id,
        owner_name: dto.owner_name,
        email: dto.email,
        phone: dto.phone,
        user_id: dto.user_id,
      },
    });
    return this.findOneOwner(owner.id);
  }

  async updateOwner(id: string, dto: UpdateFranchiseOwnerDto) {
    const existing = await this.prisma.franchiseOwner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Franchise owner not found');

    await this.prisma.franchiseOwner.update({ where: { id }, data: dto });
    return this.findOneOwner(id);
  }

  // ── Branch-Franchise Mapping ──────────────────────────────────

  async assignBranch(dto: CreateBranchFranchiseDto) {
    // Verify both entities exist
    const [branch, owner] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: dto.branch_id } }),
      this.prisma.franchiseOwner.findUnique({ where: { id: dto.franchise_owner_id } }),
    ]);
    if (!branch) throw new NotFoundException('Branch not found');
    if (!owner) throw new NotFoundException('Franchise owner not found');

    // Check for existing mapping
    const existing = await this.prisma.branchFranchise.findUnique({
      where: {
        branch_id_franchise_owner_id: {
          branch_id: dto.branch_id,
          franchise_owner_id: dto.franchise_owner_id,
        },
      },
    });
    if (existing) throw new ConflictException('Branch is already assigned to this franchise owner');

    return this.prisma.branchFranchise.create({
      data: {
        branch_id: dto.branch_id,
        franchise_owner_id: dto.franchise_owner_id,
        revenue_share_pct: dto.revenue_share_pct,
        contract_start: dto.contract_start ? new Date(dto.contract_start) : undefined,
        contract_end: dto.contract_end ? new Date(dto.contract_end) : undefined,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        franchise_owner: { select: { id: true, owner_name: true, email: true } },
      },
    });
  }

  async unassignBranch(branchId: string, franchiseOwnerId: string) {
    const mapping = await this.prisma.branchFranchise.findUnique({
      where: {
        branch_id_franchise_owner_id: {
          branch_id: branchId,
          franchise_owner_id: franchiseOwnerId,
        },
      },
    });
    if (!mapping) throw new NotFoundException('Branch-franchise mapping not found');

    return this.prisma.branchFranchise.delete({
      where: { id: mapping.id },
    });
  }

  async getBranchFranchises(branchId: string) {
    return this.prisma.branchFranchise.findMany({
      where: { branch_id: branchId },
      include: {
        franchise_owner: { select: { id: true, owner_name: true, email: true, phone: true } },
      },
    });
  }
}
