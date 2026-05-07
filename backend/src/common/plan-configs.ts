export interface PlanConfig {
  display_name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  max_branches: number;
  max_members: number;
  max_staff: number;
  storage_limit_gb: number;
  api_access: boolean;
  features: Record<string, boolean>;
  plan_type: 'regular';
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: {
    display_name: 'Free',
    description: 'Basic gym management for a single location',
    monthly_price: 0,
    annual_price: 0,
    max_branches: 1,
    max_members: 50,
    max_staff: 3,
    storage_limit_gb: 1,
    api_access: false,
    plan_type: 'regular',
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      multi_branch: false,
      staff_management: true,
      trainer_management: true,
      class_scheduling: false,
      payment_gateway: false,
      marketing_campaigns: false,
      ai_advisor: false,
      api_access: false,
      whatsapp_notifications: false,
      email_campaigns: false,
      custom_roles: false,
      audit_logs: false,
    },
  },
  starter: {
    display_name: 'Starter',
    description: 'Growing gyms with staff and class management',
    monthly_price: 999,
    annual_price: 9990,
    max_branches: 1,
    max_members: 200,
    max_staff: 10,
    storage_limit_gb: 5,
    api_access: false,
    plan_type: 'regular',
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      multi_branch: false,
      staff_management: true,
      trainer_management: true,
      class_scheduling: true,
      payment_gateway: true,
      marketing_campaigns: false,
      ai_advisor: false,
      api_access: false,
      whatsapp_notifications: true,
      email_campaigns: false,
      custom_roles: false,
      audit_logs: true,
    },
  },
  pro: {
    display_name: 'Pro',
    description: 'Multi-branch fitness chains with advanced features',
    monthly_price: 2499,
    annual_price: 24990,
    max_branches: 5,
    max_members: 1000,
    max_staff: 50,
    storage_limit_gb: 25,
    api_access: true,
    plan_type: 'regular',
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      multi_branch: true,
      staff_management: true,
      trainer_management: true,
      class_scheduling: true,
      payment_gateway: true,
      marketing_campaigns: true,
      ai_advisor: true,
      api_access: true,
      whatsapp_notifications: true,
      email_campaigns: true,
      custom_roles: true,
      audit_logs: true,
    },
  },
  enterprise: {
    display_name: 'Enterprise',
    description: 'Unlimited scale for large fitness organizations',
    monthly_price: 4999,
    annual_price: 49990,
    max_branches: 999,
    max_members: 99999,
    max_staff: 999,
    storage_limit_gb: 100,
    api_access: true,
    plan_type: 'regular',
    features: {
      member_management: true,
      check_in: true,
      manual_payments: true,
      basic_reports: true,
      multi_branch: true,
      staff_management: true,
      trainer_management: true,
      class_scheduling: true,
      payment_gateway: true,
      marketing_campaigns: true,
      ai_advisor: true,
      api_access: true,
      whatsapp_notifications: true,
      email_campaigns: true,
      custom_roles: true,
      audit_logs: true,
    },
  },
};

/**
 * Auto-seeds the SubscriptionPlan table from PLAN_CONFIGS if empty.
 * Ensures plans are always available from the database.
 */
export async function ensurePlansSeeded(prisma: {
  subscriptionPlan: {
    count: () => Promise<number>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}) {
  const count = await prisma.subscriptionPlan.count();
  if (count > 0) return;

  const entries = Object.entries(PLAN_CONFIGS);
  for (let i = 0; i < entries.length; i++) {
    const [name, config] = entries[i];
    await prisma.subscriptionPlan.create({
      data: {
        name,
        display_name: config.display_name,
        description: config.description,
        monthly_price: config.monthly_price,
        annual_price: config.annual_price,
        max_branches: config.max_branches,
        max_members: config.max_members,
        max_staff: config.max_staff,
        storage_limit_gb: config.storage_limit_gb,
        api_access: config.api_access,
        features: config.features,
        plan_type: config.plan_type,
        sort_order: i,
      },
    });
  }
}

/**
 * Returns all active regular plans from the database, seeding if needed.
 */
export async function fetchAvailablePlans(prisma: {
  subscriptionPlan: {
    count: () => Promise<number>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy: { sort_order: 'asc' };
    }) => Promise<unknown[]>;
  };
}, _planType?: 'regular') {
  await ensurePlansSeeded(prisma);
  return prisma.subscriptionPlan.findMany({
    where: { is_active: true, plan_type: 'regular' },
    orderBy: { sort_order: 'asc' },
  });
}
