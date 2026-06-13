import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { JwtPayload, resolveBranchScope } from '../common';
import { ResourceLimitService } from '../common/services/resource-limit.service';
import { BranchProvisioningService } from './branch-provisioning.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { getTenantGymId } from '../common/tenant-context';
import { DEFAULT_CURRENCY } from '../common/defaults';
import { UpdateBranchSettingsDto } from '../organization/dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    private tenant: TenantPrisma,
    private resourceLimits: ResourceLimitService,
    private provisioning: BranchProvisioningService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(
    user?: JwtPayload,
    filters?: {
      organization_id?: string;
      region_id?: string;
      status?: string;
    },
  ) {
    const where: Record<string, unknown> = {};

    // Tenant isolation is handled by the TenantPrismaExtension (gym_id filter on every query).
    // Organization filter is optional — only apply if explicitly provided.
    const orgId = filters?.organization_id || user?.organization_id;
    if (orgId) {
      where.organization_id = orgId;
    }

    // Clamp to the caller's allowed branches. Global access (owner/brand_owner,
    // or any role row with branch_id=null) bypasses this filter.
    const scope = resolveBranchScope(user);
    if (!scope.hasGlobalAccess) {
      if (scope.allowedIds === 'ALL' || scope.allowedIds.length === 0) {
        where.id = '__none__';
      } else {
        where.id = { in: scope.allowedIds };
      }
    }

    if (filters?.region_id) where.region_id = filters.region_id;
    if (filters?.status) where.status = filters.status;

    return this.tenant.client.branch.findMany({
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
    const branch = await this.tenant.client.branch.findUnique({
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

  async create(data: CreateBranchDto, studioId?: string) {
    const initMode = data.init_mode ?? 'default';

    // Validate clone mode requires a source branch
    if (initMode === 'clone' && !data.source_branch_id) {
      throw new BadRequestException('source_branch_id is required when init_mode is "clone"');
    }

    // Enforce plan-based branch limit before creation
    if (studioId) {
      await this.resourceLimits.checkBranchLimit(studioId, data.organization_id);
    }

    // Resolve organization_id — if not provided, find the first org in the tenant schema
    if (!data.organization_id) {
      const org = await this.tenant.client.organization.findFirst({ select: { id: true } });
      if (org) data.organization_id = org.id;
    }

    // Validate organization exists if provided
    if (data.organization_id) {
      const org = await this.tenant.client.organization.findUnique({
        where: { id: data.organization_id },
      });
      if (!org) throw new NotFoundException('Organization not found');
    }

    // Validate region exists and belongs to organization if provided
    if (data.region_id) {
      const region = await this.tenant.client.region.findUnique({
        where: { id: data.region_id },
      });
      if (!region) throw new NotFoundException('Region not found');
      if (data.organization_id && region.organization_id !== data.organization_id) {
        throw new NotFoundException('Region does not belong to the specified organization');
      }
    }

    // When provisioning is needed, start in 'provisioning' status
    const status = initMode !== 'empty'
      ? 'provisioning'
      : (data.status ?? 'active');

    const branch = await this.tenant.client.branch.create({
      data: {
        gym_id: getTenantGymId()!,
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
        status,
        opening_time: data.opening_time,
        closing_time: data.closing_time,
      },
    });

    // Fire-and-forget provisioning
    this.provisioning
      .provision(branch.id, initMode, data.source_branch_id)
      .catch((err) =>
        this.logger.error(`Provisioning failed for branch ${branch.id}: ${err.message}`, err.stack),
      );

    // Emit domain event so listeners (e.g., expense defaults) can react
    // without BranchesModule needing to import PaymentsModule (no circular deps).
    this.events.emit('branch.created', {
      gym_id: getTenantGymId()!,
      branch_id: branch.id,
    });

    return this.findOne(branch.id);
  }

  async update(id: string, data: UpdateBranchDto) {
    const existing = await this.tenant.client.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Branch not found');

    // Validate organization if being changed
    if (data.organization_id) {
      const org = await this.tenant.client.organization.findUnique({
        where: { id: data.organization_id },
      });
      if (!org) throw new NotFoundException('Organization not found');
    }

    // Validate region if being changed
    if (data.region_id) {
      const region = await this.tenant.client.region.findUnique({
        where: { id: data.region_id },
      });
      if (!region) throw new NotFoundException('Region not found');
    }

    await this.tenant.client.branch.update({ where: { id }, data });
    return this.findOne(id);
  }

  async deleteBranch(id: string) {
    const existing = await this.tenant.client.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Branch not found');

    // Cascade delete all linked data in a transaction
    const result = await this.tenant.client.$transaction(async (tx) => {
      // Delete check-ins for members of this branch
      const deletedCheckIns = await tx.checkIn.deleteMany({ where: { branch_id: id } });

      // Delete class enrollments → classes
      await tx.classEnrollment.deleteMany({ where: { class: { branch_id: id } } });
      const deletedClasses = await tx.class.deleteMany({ where: { branch_id: id } });

      // Delete financial transactions, payments, invoices, expenses for this branch
      await tx.financialTransaction.deleteMany({ where: { branch_id: id } });
      const deletedPayments = await tx.payment.deleteMany({ where: { branch_id: id } });
      await tx.expense.deleteMany({ where: { branch_id: id } });

      // Delete member sub-records then members
      const memberIds = (await tx.member.findMany({ where: { branch_id: id }, select: { id: true } })).map(m => m.id);
      if (memberIds.length > 0) {
        await tx.memberMembership.deleteMany({ where: { member_id: { in: memberIds } } });
        await tx.memberBodyStats.deleteMany({ where: { member_id: { in: memberIds } } });
        await tx.memberProgressPhoto.deleteMany({ where: { member_id: { in: memberIds } } });
        await tx.memberNote.deleteMany({ where: { member_id: { in: memberIds } } });
        await tx.memberDocument.deleteMany({ where: { member_id: { in: memberIds } } });
        await tx.memberTagAssignment.deleteMany({ where: { member_id: { in: memberIds } } });
      }
      const deletedMembers = await tx.member.deleteMany({ where: { branch_id: id } });

      // Delete staff linked to this branch
      const deletedStaff = await tx.staff.deleteMany({ where: { branch_id: id } });

      // Delete membership plans scoped to this branch
      await tx.membershipPlan.deleteMany({ where: { branch_id: id } });

      // Delete branch settings
      await tx.branchSettings.deleteMany({ where: { branch_id: id } });

      // Finally delete the branch
      await tx.branch.delete({ where: { id } });

      return {
        deleted: true,
        branch_id: id,
        branch_name: existing.name,
        counts: {
          members: deletedMembers.count,
          check_ins: deletedCheckIns.count,
          classes: deletedClasses.count,
          payments: deletedPayments.count,
          staff: deletedStaff.count,
        },
      };
    });

    return result;
  }

  // ── Branch Settings ───────────────────────────────────────────

  async getSettings(branchId: string) {
    const branch = await this.tenant.client.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const settings = await this.tenant.client.branchSettings.findUnique({
      where: { branch_id: branchId },
    });
    if (!settings) throw new NotFoundException('Branch settings not found');
    return settings;
  }

  async updateSettings(branchId: string, dto: UpdateBranchSettingsDto) {
    const branch = await this.tenant.client.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.tenant.client.branchSettings.upsert({
      where: { branch_id: branchId },
      update: {
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.tax_percentage !== undefined && { tax_percentage: dto.tax_percentage }),
        ...(dto.membership_policy !== undefined && { membership_policy: dto.membership_policy }),
        ...(dto.checkin_policy !== undefined && { checkin_policy: dto.checkin_policy }),
        ...(dto.notification_prefs !== undefined && { notification_prefs: dto.notification_prefs }),
      },
      create: {
        gym_id: getTenantGymId()!,
        branch_id: branchId,
        currency: dto.currency ?? DEFAULT_CURRENCY,
        tax_percentage: dto.tax_percentage ?? 0,
        membership_policy: dto.membership_policy ?? {},
        checkin_policy: dto.checkin_policy ?? {},
        notification_prefs: dto.notification_prefs ?? {},
      },
    });
  }
}
