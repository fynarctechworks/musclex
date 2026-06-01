import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantGymId } from '../common/tenant-context';
import { Logger } from '@nestjs/common';

const logger = new Logger('TenantPrismaExtension');

/**
 * ────────────────────────────────────────────────────────────────
 * TENANT PRISMA EXTENSION
 * ────────────────────────────────────────────────────────────────
 *
 * Defense-in-depth layer for multi-tenant isolation.
 *
 * Architecture:
 *   Layer 1: PostgreSQL search_path (schema-per-tenant)  — set by PrismaService.$use
 *   Layer 2: gym_id column filter (this extension)       — injected on every query
 *   Layer 3: Row-Level Security (RLS)                    — enforced by PostgreSQL
 *
 * This extension intercepts ALL Prisma model operations and:
 *   - READ ops (findMany, findFirst, findUnique, count, aggregate, groupBy):
 *     Injects `gym_id = currentGymId` into the WHERE clause
 *   - WRITE ops (create, createMany, update, updateMany, upsert, delete, deleteMany):
 *     Injects gym_id into data for creates, into WHERE for updates/deletes
 *
 * IMPORTANT:
 *   - Only applies to studio_template models (models with a gym_id column)
 *   - Public schema models (Studio, UserIdentity, etc.) are NOT filtered
 *   - READ ops without gym_id context: pass through (guards should reject first)
 *   - WRITE ops without gym_id context: BLOCKED with error (defense-in-depth)
 */

// Models in studio_template that have gym_id column.
// This MUST be kept in sync with the Prisma schema.
// Using a Set for O(1) lookup.
const TENANT_MODELS = new Set([
  'Organization',
  'OrganizationSettings',
  'Region',
  'Branch',
  'BranchSettings',
  'FranchiseOwner',
  'BranchFranchise',
  'Member',
  'MemberProfile',
  'MemberBodyStats',
  'MemberProgressPhoto',
  'MemberNote',
  'MemberTag',
  'MemberTagAssignment',
  'MemberDocument',
  'MemberReferral',
  'MembershipPlan',
  'MemberMembership',
  'MembershipFreeze',
  'FamilyMembership',
  'FamilyMember',
  'CorporateAccount',
  'CorporateMember',
  'GlobalAccessPass',
  'CheckIn',
  'ClassTemplate',
  'StudioRoom',
  'ClassSession',
  'ClassBooking',
  'ClassWaitlist',
  'TrainerAssignment',
  'ClassAttendance',
  'ClassRecurringRule',
  'Class',
  'ClassEnrollment',
  'Role',
  'RolePermission',
  'Staff',
  'StaffProfile',
  'StaffAvailability',
  'StaffAttendance',
  'TrainerClient',
  'TrainerSession',
  'PayrollConfig',
  'TrainerRevenue',
  'StaffShift',
  'LeaveRequest',
  'PayrollRecord',
  'TrainerPerformanceRecord',
  'AuditLog',
  'Payment',
  'Expense',
  'ExpenseCategory',
  'ExpenseMetric',
  'NotificationLog',
  'Campaign',
  'Lead',
  'LeadActivity',
  'CampaignAudience',
  'MessageTemplate',
  'AutomationWorkflow',
  'WorkflowAction',
  'ReferralProgram',
  'PushNotification',
  'ProductCategory',
  'Product',
  'Inventory',
  'InventoryTransaction',
  'Supplier',
  'PurchaseOrder',
  'PurchaseOrderItem',
  'PosSale',
  'PosSaleItem',
  'ProductReturn',
  'AiConversation',
  'SsoProvider',
  'ApiKey',
  'MemberInvoice',
  'InvoiceItem',
  'PaymentGatewayConfig',
  'Refund',
  'Discount',
  'TaxRate',
  'FinancialTransaction',
  'PaymentRetryLog',
  'DailyGymMetrics',
  'MembershipAnalytics',
  'RevenueAnalytics',
  'ClassAnalytics',
  'MemberBehaviorAnalytics',
  'TrainerAnalytics',
  'CampaignAnalyticsRecord',
  'Webhook',
  'WebhookDelivery',
  'Integration',
  'FeatureFlag',
  'WhiteLabelConfig',
  'SystemNotification',
  'ConsentLog',
  'DataRequest',
  'BookingTransition',
  'ProviderAvailabilitySlot',
  'BookingDispute',
  'ServiceProvider',
  'ServiceCatalog',
  'ServiceBooking',
  'Review',
  'Chat',
  'ChatMessage',
  'Notification',
  'ProviderSubscription',
  'DashboardMetrics',
  'DomainEvent',
  'StaffPermissionOverride',
  'Exercise',
  'WorkoutPlan',
  'WorkoutPlanExercise',
  'AssignedWorkout',
  'WorkoutLog',
  'WorkoutSetLog',
  'PersonalRecord',
]);

function isTenantModel(model: string | undefined): boolean {
  return !!model && TENANT_MODELS.has(model);
}

/**
 * Guard: blocks WRITE operations on tenant models when no gym_id is in context.
 * This is defense-in-depth — auth guards should reject unauthenticated requests
 * before reaching here, but if they don't, this prevents data corruption.
 */
function requireGymIdForWrite(model: string | undefined, operation: string, gymId: string | undefined): void {
  if (isTenantModel(model) && !gymId) {
    const msg = `TENANT SAFETY: Blocked ${operation} on ${model} — no gym_id in context. ` +
      `This indicates a missing auth guard or tenant middleware.`;
    logger.error(msg);
    throw new Error(msg);
  }
}

/**
 * Injects gym_id into a WHERE clause object.
 * Handles both simple objects and nested Prisma filters.
 */
function injectGymIdWhere(where: any, gymId: string): any {
  if (!where) return { gym_id: gymId };
  return { ...where, gym_id: gymId };
}

/**
 * Injects gym_id into a data object for CREATE operations.
 */
function injectGymIdData(data: any, gymId: string): any {
  if (!data) return { gym_id: gymId };
  // Don't overwrite if already set (allows explicit override in migrations/seeds)
  if (data.gym_id) return data;
  return { ...data, gym_id: gymId };
}

/**
 * Creates the tenant-scoped Prisma extension.
 *
 * Usage:
 *   const tenantPrisma = createTenantExtension(prismaClient);
 *   // All queries through tenantPrisma auto-filter by gym_id
 */
export function createTenantExtension(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          const gymId = getTenantGymId();
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async findFirst({ model, args, query }) {
          const gymId = getTenantGymId();
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async findUnique({ model, args, query }) {
          // findUnique uses unique fields in where — we can't inject gym_id there.
          // Instead, we verify post-fetch that the record belongs to this tenant.
          const gymId = getTenantGymId();
          const result = await query(args);
          if (gymId && isTenantModel(model) && result) {
            if ((result as any).gym_id && (result as any).gym_id !== gymId) {
              logger.error(
                `TENANT VIOLATION: ${model}.findUnique returned record with gym_id=${(result as any).gym_id}, expected=${gymId}`,
              );
              return null; // Silently hide — do not expose cross-tenant data
            }
          }
          return result;
        },

        async findFirstOrThrow({ model, args, query }) {
          const gymId = getTenantGymId();
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async findUniqueOrThrow({ model, args, query }) {
          const gymId = getTenantGymId();
          const result = await query(args);
          if (gymId && isTenantModel(model) && result) {
            if ((result as any).gym_id && (result as any).gym_id !== gymId) {
              logger.error(
                `TENANT VIOLATION: ${model}.findUniqueOrThrow returned cross-tenant record`,
              );
              throw new Error('Record not found'); // Mimic not-found to prevent data leak
            }
          }
          return result;
        },

        async count({ model, args, query }) {
          const gymId = getTenantGymId();
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async aggregate({ model, args, query }) {
          const gymId = getTenantGymId();
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async groupBy({ model, args, query }) {
          const gymId = getTenantGymId();
          if (gymId && isTenantModel(model)) {
            (args as any).where = injectGymIdWhere((args as any).where, gymId);
          }
          return query(args);
        },

        async create({ model, args, query }) {
          const gymId = getTenantGymId();
          requireGymIdForWrite(model, 'create', gymId);
          if (gymId && isTenantModel(model)) {
            args.data = injectGymIdData(args.data as any, gymId);
          }
          return query(args);
        },

        async createMany({ model, args, query }) {
          const gymId = getTenantGymId();
          requireGymIdForWrite(model, 'createMany', gymId);
          if (gymId && isTenantModel(model)) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((d: any) => injectGymIdData(d, gymId));
            } else {
              args.data = injectGymIdData(args.data as any, gymId);
            }
          }
          return query(args);
        },

        async update({ model, args, query }) {
          const gymId = getTenantGymId();
          requireGymIdForWrite(model, 'update', gymId);
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async updateMany({ model, args, query }) {
          const gymId = getTenantGymId();
          requireGymIdForWrite(model, 'updateMany', gymId);
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async upsert({ model, args, query }) {
          const gymId = getTenantGymId();
          requireGymIdForWrite(model, 'upsert', gymId);
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
            args.create = injectGymIdData(args.create as any, gymId);
          }
          return query(args);
        },

        async delete({ model, args, query }) {
          const gymId = getTenantGymId();
          requireGymIdForWrite(model, 'delete', gymId);
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },

        async deleteMany({ model, args, query }) {
          const gymId = getTenantGymId();
          requireGymIdForWrite(model, 'deleteMany', gymId);
          if (gymId && isTenantModel(model)) {
            args.where = injectGymIdWhere(args.where, gymId);
          }
          return query(args);
        },
      },
    },
  });
}

/** Type alias for the extended client — use this in service constructors */
export type TenantPrismaClient = ReturnType<typeof createTenantExtension>;
