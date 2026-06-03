/**
 * ────────────────────────────────────────────────────────────────
 * TENANT MODELS — single source of truth
 * ────────────────────────────────────────────────────────────────
 *
 * Every Prisma model with a gym_id column. BOTH tenant-isolation layers import
 * this one list so they can never drift:
 *   - the $use middleware in prisma.service.ts (load-bearing: scopes the base
 *     `prisma.model.*` client every service uses)
 *   - the $extends tenant client in tenant-prisma.extension.ts (opt-in defense
 *     in depth, `prisma.tenant.*`)
 *
 * Adding a new gym_id model? Add it HERE only. (A drift between two copies of
 * this list previously caused a cross-tenant read leak — never reintroduce that.)
 */
export const TENANT_MODELS: ReadonlySet<string> = new Set<string>([
  'Organization', 'OrganizationSettings', 'Region', 'Branch',
  'BranchSettings', 'FranchiseOwner', 'BranchFranchise', 'Member',
  'MemberProfile', 'MemberBodyStats', 'MemberProgressPhoto', 'MemberNote',
  'MemberTag', 'MemberTagAssignment', 'MemberDocument', 'MemberReferral',
  'MembershipPlan', 'MemberMembership', 'MembershipFreeze', 'FamilyMembership',
  'FamilyMember', 'CorporateAccount', 'CorporateMember', 'GlobalAccessPass',
  'CheckIn', 'ClassTemplate', 'StudioRoom', 'ClassSession',
  'ClassBooking', 'ClassWaitlist', 'TrainerAssignment', 'ClassAttendance',
  'ClassRecurringRule', 'Class', 'ClassEnrollment', 'Role',
  'RolePermission', 'Staff', 'StaffProfile', 'StaffAvailability',
  'StaffAttendance', 'TrainerClient', 'TrainerSession', 'PayrollConfig',
  'TrainerRevenue', 'StaffShift', 'LeaveRequest', 'PayrollRecord',
  'TrainerPerformanceRecord', 'AuditLog', 'Payment', 'Expense',
  'NotificationLog', 'Campaign', 'Lead', 'LeadActivity',
  'CampaignAudience', 'MessageTemplate', 'AutomationWorkflow', 'WorkflowAction',
  'ReferralProgram', 'PushNotification', 'ProductCategory', 'Product',
  'Inventory', 'InventoryTransaction', 'Supplier', 'PurchaseOrder',
  'PurchaseOrderItem', 'PosSale', 'PosSaleItem', 'ProductReturn',
  'AiConversation', 'SsoProvider', 'ApiKey', 'MemberInvoice',
  'InvoiceItem', 'PaymentGatewayConfig', 'Refund', 'Discount',
  'TaxRate', 'FinancialTransaction', 'PaymentRetryLog', 'DailyGymMetrics',
  'MembershipAnalytics', 'RevenueAnalytics', 'ClassAnalytics', 'MemberBehaviorAnalytics',
  'TrainerAnalytics', 'CampaignAnalyticsRecord', 'Webhook', 'WebhookDelivery',
  'Integration', 'FeatureFlag', 'WhiteLabelConfig', 'SystemNotification',
  'ConsentLog', 'DataRequest', 'Notification',
  'DashboardMetrics', 'DomainEvent', 'StaffPermissionOverride',
  'ExpenseCategory', 'ExpenseMetric', 'Exercise', 'WorkoutPlan',
  'WorkoutPlanExercise', 'AssignedWorkout', 'WorkoutLog', 'WorkoutSetLog',
  'PersonalRecord', 'FoodItem', 'MealLog', 'MealLogItem',
  'WaterLog', 'NutritionGoal', 'ExerciseFavorite', 'TrainerChatMessage',
  'MemberDeviceToken', 'Challenge', 'ChallengeParticipant',
  // ────────────────────────────────────────────────────────────────
  // D4 fix (2026-06-03): gym_id models that were MISSING from this registry,
  // so the load-bearing $use isolation layer was NOT auto-scoping them.
  // Added after a per-call-site audit of all 59 usages — see
  // docs/RLS-D4-REGISTRY-FIX-PLAN-2026-06-03.md. Each is read-by-FK (gym_id
  // injected) or created with an explicit gym_id, so registering only tightens.
  // The 3 compound-unique upsert models were made explicitly gym-scoped at their
  // call sites (Prisma extendedWhereUnique) before registration.
  // ────────────────────────────────────────────────────────────────
  'Wallet', 'WalletTransaction', 'Document', 'DocumentDelivery',
  'Bundle', 'BundleItem', 'StockTransfer', 'StockTransferItem',
  'ProductBatch', 'ProductImage', 'QrTokenAudit', 'CheckInEvent',
  'CheckInDevice', 'MemberTransferLog', 'MembershipBranchAccess',
  'MemberReferralReward', 'MemberReferralEvent', 'MemberReferralFraudSignal',
  'LoyaltyConfig', 'BiometricEnrollment', 'StaffBiometricEnrollment',
  'BranchProductPrice',
  // ────────────────────────────────────────────────────────────────
  // Health Data Platform (Member App, 2026-06-03): wearable telemetry.
  // All three carry gym_id (injected on read-by-FK, explicit on write), so
  // registering here only tightens the $use + tenant-extension isolation.
  // ────────────────────────────────────────────────────────────────
  'MemberHealthSample', 'MemberHealthDaily', 'MemberWearableConnection',
]);
