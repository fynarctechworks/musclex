import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { getTenantSchema, getTenantGymId } from '../common/tenant-context';
import { createTenantExtension, TenantPrismaClient } from './tenant-prisma.extension';
import { createBranchScopeExtension } from './branch-scope.extension';

// ────────────────────────────────────────────────────────────────
// Tenant models — must match TENANT_MODELS in tenant-prisma.extension.ts.
// These are all models with a gym_id column. Any query against these models
// is auto-filtered by gym_id at the $use middleware layer below.
// ────────────────────────────────────────────────────────────────
const TENANT_MODELS_PRISMA: ReadonlySet<string> = new Set<string>([
  'Organization', 'OrganizationSettings', 'Region', 'Branch', 'BranchSettings',
  'FranchiseOwner', 'BranchFranchise', 'Member', 'MemberProfile', 'MemberBodyStats',
  'MemberProgressPhoto', 'MemberNote', 'MemberTag', 'MemberTagAssignment',
  'MemberDocument', 'MemberReferral', 'MembershipPlan', 'MemberMembership',
  'MembershipFreeze', 'FamilyMembership', 'FamilyMember', 'CorporateAccount',
  'CorporateMember', 'GlobalAccessPass', 'CheckIn', 'ClassTemplate', 'StudioRoom',
  'ClassSession', 'ClassBooking', 'ClassWaitlist', 'TrainerAssignment',
  'ClassAttendance', 'ClassRecurringRule', 'Class', 'ClassEnrollment',
  'Role', 'RolePermission', 'Staff', 'StaffProfile', 'StaffAvailability',
  'StaffAttendance', 'TrainerClient', 'TrainerSession', 'PayrollConfig',
  'TrainerRevenue', 'StaffShift', 'LeaveRequest', 'PayrollRecord',
  'TrainerPerformanceRecord', 'AuditLog', 'Payment', 'Expense',
  'NotificationLog', 'Campaign', 'Lead', 'LeadActivity', 'CampaignAudience',
  'MessageTemplate', 'AutomationWorkflow', 'WorkflowAction', 'ReferralProgram',
  'PushNotification', 'ProductCategory', 'Product', 'Inventory',
  'InventoryTransaction', 'Supplier', 'PurchaseOrder', 'PurchaseOrderItem',
  'PosSale', 'PosSaleItem', 'ProductReturn', 'AiConversation', 'SsoProvider',
  'ApiKey', 'MemberInvoice', 'InvoiceItem', 'PaymentGatewayConfig', 'Refund',
  'Discount', 'TaxRate', 'FinancialTransaction', 'PaymentRetryLog',
  'DailyGymMetrics', 'MembershipAnalytics', 'RevenueAnalytics', 'ClassAnalytics',
  'MemberBehaviorAnalytics', 'TrainerAnalytics', 'CampaignAnalyticsRecord',
  'Webhook', 'WebhookDelivery', 'Integration', 'FeatureFlag', 'WhiteLabelConfig',
  'SystemNotification', 'ConsentLog', 'DataRequest', 'BookingTransition',
  'ProviderAvailabilitySlot', 'BookingDispute', 'ServiceProvider',
  'ServiceCatalog', 'ServiceBooking', 'Review', 'Chat', 'ChatMessage',
  'Notification', 'ProviderSubscription', 'DashboardMetrics', 'DomainEvent',
  'StaffPermissionOverride', 'ExpenseCategory', 'ExpenseMetric',
]);

const READ_ACTIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy',
]);
const WHERE_MUTATION_ACTIONS = new Set([
  'update', 'updateMany', 'delete', 'deleteMany',
]);

function injectGymIdInWhere(where: any, gymId: string): any {
  if (!where || typeof where !== 'object') return { gym_id: gymId };
  if (where.gym_id !== undefined) return where; // respect caller-provided filter
  return { ...where, gym_id: gymId };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Tenant-scoped Prisma client.
   * ALL service-layer code should use `prisma.tenant` instead of raw `prisma`.
   * This auto-injects gym_id on every query as defense-in-depth.
   */
  public readonly tenant: TenantPrismaClient;

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Create the tenant-scoped extension
    this.tenant = createTenantExtension(this);

    // Branch-scope observer — logs missing branch filters without modifying queries
    createBranchScopeExtension(this);

    // ────────────────────────────────────────────────────────────
    // NOTE: Prisma with multiSchema generates fully-qualified table
    // names ("studio_template"."table_name"), so SET search_path has
    // NO effect. Tenant isolation relies entirely on:
    //   Layer 2: gym_id column filter (tenant-prisma.extension.ts)
    //   Layer 3: RLS policies (app.gym_id session variable)
    //
    // The $use middleware below only sets app.gym_id for RLS.
    // ────────────────────────────────────────────────────────────
    this.$use(async (params, next) => {
      const gymId = getTenantGymId();

      if (params.model && gymId) {
        try {
          // Parameterized — set_config() is injection-safe; avoids $executeRawUnsafe.
          // Third arg `false` = session-scoped (not transaction-local).
          await this.$queryRaw`SELECT set_config('app.gym_id', ${gymId}, false)`;
        } catch (err) {
          this.logger.warn(
            `Failed to set app.gym_id="${gymId}": ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      return next(params);
    });

    // ────────────────────────────────────────────────────────────
    // GLOBAL TENANT ISOLATION — Injects gym_id on every query against
    // tenant models. Services using raw `this.prisma.model.*` are now
    // safe by default; the extension client (this.tenant) is kept as
    // defense-in-depth for callers that opt in explicitly.
    // ────────────────────────────────────────────────────────────
    this.$use(async (params, next) => {
      const gymId = getTenantGymId();
      if (!gymId || !params.model || !TENANT_MODELS_PRISMA.has(params.model)) {
        return next(params);
      }

      const { action, args } = params;

      if (READ_ACTIONS.has(action)) {
        params.args = { ...args, where: injectGymIdInWhere(args?.where, gymId) };
        return next(params);
      }

      if (action === 'findUnique' || action === 'findUniqueOrThrow') {
        // findUnique/ByUniqueInput can't accept gym_id in where; post-check the result.
        const result = await next(params);
        if (result && (result as any).gym_id && (result as any).gym_id !== gymId) {
          this.logger.error(
            `TENANT VIOLATION: ${params.model}.${action} returned cross-tenant record`,
          );
          if (action === 'findUniqueOrThrow') {
            throw new Error('Record not found');
          }
          return null;
        }
        return result;
      }

      if (WHERE_MUTATION_ACTIONS.has(action)) {
        params.args = { ...args, where: injectGymIdInWhere(args?.where, gymId) };
        return next(params);
      }

      if (action === 'create') {
        const data = args?.data;
        if (data && typeof data === 'object' && !Array.isArray(data) && !(data as any).gym_id) {
          params.args = { ...args, data: { ...(data as any), gym_id: gymId } };
        }
        return next(params);
      }

      if (action === 'createMany') {
        const data = args?.data;
        if (Array.isArray(data)) {
          params.args = {
            ...args,
            data: data.map((d: any) =>
              d && typeof d === 'object' && !d.gym_id ? { ...d, gym_id: gymId } : d,
            ),
          };
        } else if (data && typeof data === 'object' && !(data as any).gym_id) {
          params.args = { ...args, data: { ...(data as any), gym_id: gymId } };
        }
        return next(params);
      }

      if (action === 'upsert') {
        const newArgs: any = { ...args };
        newArgs.where = injectGymIdInWhere(args?.where, gymId);
        if (args?.create && typeof args.create === 'object' && !(args.create as any).gym_id) {
          newArgs.create = { ...args.create, gym_id: gymId };
        }
        params.args = newArgs;
        return next(params);
      }

      return next(params);
    });
  }

  async onModuleInit() {
    try {
      const connectPromise = this.$connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000),
      );
      await Promise.race([connectPromise, timeoutPromise]);
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.warn(
        `Database connection failed: ${error.message}. API will start but DB queries will fail.`,
      );
    }
  }

  /**
   * Verify that the current connection's search_path matches the expected tenant.
   * Use in critical operations (payments, PII access) as defense-in-depth.
   */
  async verifyTenantContext(expectedStudioId: string): Promise<boolean> {
    const result = await this.$queryRaw<Array<{ current_setting: string }>>`
      SELECT current_setting('search_path') as current_setting
    `;
    const currentPath = result?.[0]?.current_setting || '';
    const expectedSchema = `studio_${expectedStudioId.replace(/-/g, '_')}`;
    return currentPath.includes(expectedSchema);
  }

  /**
   * Verify BOTH search_path AND app.gym_id match for critical operations.
   * Call this before payments, PII exports, or data deletions.
   */
  async verifyFullTenantIsolation(expectedStudioId: string): Promise<boolean> {
    const result = await this.$queryRaw<
      Array<{ search_path: string; gym_id: string }>
    >`
      SELECT
        current_setting('search_path') as search_path,
        current_setting('app.gym_id', true) as gym_id
    `;
    const row = result?.[0];
    if (!row) return false;

    const expectedSchema = `studio_${expectedStudioId.replace(/-/g, '_')}`;
    const pathOk = row.search_path.includes(expectedSchema);
    const gymOk = row.gym_id === expectedStudioId;

    if (!pathOk || !gymOk) {
      this.logger.error(
        `TENANT ISOLATION FAILURE: expected studio=${expectedStudioId}, ` +
        `got search_path="${row.search_path}", app.gym_id="${row.gym_id}"`,
      );
    }

    return pathOk && gymOk;
  }
}
