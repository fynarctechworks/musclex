import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Prisma } from '../../node_modules/.prisma/client-tenant';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { EventStoreService } from '../events/event-store.service';
import { getTenantGymId } from '../common/tenant-context';

type ProvisionMode = 'default' | 'clone' | 'empty';

@Injectable()
export class BranchProvisioningService {
  private readonly logger = new Logger(BranchProvisioningService.name);

  constructor(
    private tenant: TenantPrisma,
    @Inject(forwardRef(() => EventStoreService))
    private eventStore: EventStoreService,
  ) {}

  async provision(
    branchId: string,
    mode: ProvisionMode,
    sourceBranchId?: string,
  ): Promise<void> {
    try {
      switch (mode) {
        case 'empty':
          break;

        case 'default':
          await this.seedDefaults(branchId);
          break;

        case 'clone':
          if (!sourceBranchId) {
            throw new Error('sourceBranchId is required for clone mode');
          }
          await this.cloneFromSource(branchId, sourceBranchId);
          break;
      }

      await this.tenant.client.branch.update({
        where: { id: branchId },
        data: { status: 'active' },
      });
    } catch (error) {
      this.logger.error(
        `Branch provisioning failed for ${branchId} (mode=${mode}): ${error.message}`,
        error.stack,
      );
      await this.tenant.client.branch.update({
        where: { id: branchId },
        data: { status: 'failed' },
      });
    }
  }

  async retry(branchId: string): Promise<void> {
    const branch = await this.tenant.client.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }

    if (branch.status !== 'failed') {
      throw new Error(
        `Cannot retry provisioning for branch with status "${branch.status}". Only failed branches can be retried.`,
      );
    }

    await this.provision(branchId, 'default');
  }

  private async seedDefaults(branchId: string): Promise<void> {
    const gymId = getTenantGymId()!;

    await this.tenant.client.$transaction(async (tx) => {
      const defaultPlans = [
        {
          gym_id: gymId,
          branch_id: branchId,
          name: 'Monthly Basic',
          plan_type: 'monthly',
          duration_days: 30,
          price: 1499,
          currency: 'INR',
          is_active: true,
        },
        {
          gym_id: gymId,
          branch_id: branchId,
          name: 'Quarterly Standard',
          plan_type: 'quarterly',
          duration_days: 90,
          price: 3999,
          currency: 'INR',
          is_active: true,
        },
        {
          gym_id: gymId,
          branch_id: branchId,
          name: 'Annual Premium',
          plan_type: 'yearly',
          duration_days: 365,
          price: 11999,
          currency: 'INR',
          is_active: true,
        },
      ];

      for (const plan of defaultPlans) {
        await tx.membershipPlan.create({ data: plan });
      }

      await tx.branchSettings.create({
        data: {
          gym_id: gymId,
          branch_id: branchId,
          currency: 'INR',
          tax_percentage: 0,
          membership_policy: {},
          checkin_policy: {},
          notification_prefs: {},
        },
      });

      await this.eventStore.emit(tx, {
        aggregate_type: 'branch',
        aggregate_id: branchId,
        event_type: 'BRANCH_INITIALIZED',
        payload: { mode: 'default', plans_created: defaultPlans.length },
        branch_id: branchId,
      });
    });
  }

  private async cloneFromSource(
    branchId: string,
    sourceBranchId: string,
  ): Promise<void> {
    const gymId = getTenantGymId()!;

    await this.tenant.client.$transaction(async (tx) => {
      // Clone membership plans
      const sourcePlans = await tx.membershipPlan.findMany({
        where: { branch_id: sourceBranchId },
      });

      for (const plan of sourcePlans) {
        const {
          id,
          created_at,
          updated_at,
          allowed_hours_json,
          feature_flags,
          branch_price_overrides,
          ...planData
        } = plan;
        await tx.membershipPlan.create({
          data: {
            ...planData,
            branch_id: branchId,
            gym_id: gymId,
            // Prisma's create input rejects raw `null` for Json columns —
            // use Prisma.JsonNull (nullable) or {} (non-nullable with default).
            allowed_hours_json: allowed_hours_json ?? Prisma.JsonNull,
            feature_flags: (feature_flags as Prisma.InputJsonValue) ?? {},
            branch_price_overrides: (branch_price_overrides as Prisma.InputJsonValue) ?? {},
          },
        });
      }

      // Clone class templates
      const sourceTemplates = await tx.classTemplate.findMany({
        where: { branch_id: sourceBranchId },
      });

      for (const template of sourceTemplates) {
        const { id, created_at, updated_at, ...templateData } = template;
        await tx.classTemplate.create({
          data: { ...templateData, branch_id: branchId, gym_id: gymId },
        });
      }

      // Clone branch settings if exists
      const sourceSettings = await tx.branchSettings.findUnique({
        where: { branch_id: sourceBranchId },
      });

      if (sourceSettings) {
        await tx.branchSettings.create({
          data: {
            gym_id: gymId,
            branch_id: branchId,
            currency: sourceSettings.currency,
            tax_percentage: sourceSettings.tax_percentage,
            membership_policy: sourceSettings.membership_policy ?? {},
            checkin_policy: sourceSettings.checkin_policy ?? {},
            notification_prefs: sourceSettings.notification_prefs ?? {},
          },
        });
      }

      await this.eventStore.emit(tx, {
        aggregate_type: 'branch',
        aggregate_id: branchId,
        event_type: 'BRANCH_INITIALIZED',
        payload: {
          mode: 'clone',
          source_branch_id: sourceBranchId,
          plans_cloned: sourcePlans.length,
          templates_cloned: sourceTemplates.length,
        },
        branch_id: branchId,
      });
    });
  }
}
