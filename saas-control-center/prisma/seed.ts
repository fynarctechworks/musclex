import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SaaS Control Center...');

  // 1. Create Super Admin
  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      'SUPER_ADMIN_PASSWORD env var is required and must be at least 12 characters. ' +
      'Set it in .env before running seed.',
    );
  }
  if (!adminEmail) {
    throw new Error('SUPER_ADMIN_EMAIL env var is required. Set it in .env before running seed.');
  }
  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password_hash: await bcrypt.hash(adminPassword, 12),
      name: 'Super Admin',
    },
  });
  console.log(`Admin: ${admin.email}`);

  // 2. Create Plans — aligned with backend PLAN_CONFIGS (src/common/plan-configs.ts)
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      description: 'Basic gym management for a single location',
      price_monthly: 0,
      price_yearly: 0,
      features: {
        member_management: true,
        check_in: true,
        manual_payments: true,
        basic_reports: true,
        staff_management: true,
        trainer_management: true,
        class_scheduling: false,
        payment_gateway: false,
        marketing_campaigns: false,
        ai_advisor: false,
        api_access: false,
      },
      limits: { max_members: 50, max_branches: 1, max_staff: 3, storage_mb: 1024 },
      sort_order: 0,
    },
  });

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'starter' },
    update: {},
    create: {
      name: 'starter',
      description: 'Growing gyms with staff and class management',
      price_monthly: 999,
      price_yearly: 9990,
      features: {
        member_management: true,
        check_in: true,
        manual_payments: true,
        basic_reports: true,
        staff_management: true,
        trainer_management: true,
        class_scheduling: true,
        payment_gateway: true,
        marketing_campaigns: false,
        ai_advisor: false,
        api_access: false,
        whatsapp_notifications: true,
        audit_logs: true,
      },
      limits: { max_members: 200, max_branches: 1, max_staff: 10, storage_mb: 5120 },
      sort_order: 1,
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'pro' },
    update: {},
    create: {
      name: 'pro',
      description: 'Multi-branch fitness chains with advanced features',
      price_monthly: 2499,
      price_yearly: 24990,
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
      limits: { max_members: 1000, max_branches: 5, max_staff: 50, storage_mb: 25600 },
      sort_order: 2,
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'enterprise' },
    update: {},
    create: {
      name: 'enterprise',
      description: 'Unlimited scale for large fitness organizations',
      price_monthly: 4999,
      price_yearly: 49990,
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
      limits: { max_members: 99999, max_branches: 999, max_staff: 999, storage_mb: 102400 },
      sort_order: 3,
    },
  });
  console.log(`Plans: ${freePlan.name}, ${starterPlan.name}, ${proPlan.name}, ${enterprisePlan.name}`);

  // 3. Create Feature Flags — aligned with backend plan-configs.ts feature keys
  const flags = [
    { key: 'member_management', name: 'Member Management', is_global: true },
    { key: 'check_in', name: 'Check-In System', is_global: true },
    { key: 'manual_payments', name: 'Manual Payments', is_global: true },
    { key: 'basic_reports', name: 'Basic Reports', is_global: true },
    { key: 'staff_management', name: 'Staff Management', is_global: true },
    { key: 'trainer_management', name: 'Trainer Management', is_global: true },
    { key: 'class_scheduling', name: 'Class Scheduling', is_global: false },
    { key: 'payment_gateway', name: 'Payment Gateway (Razorpay/Stripe)', is_global: false },
    { key: 'marketing_campaigns', name: 'Marketing & Campaigns', is_global: false },
    { key: 'ai_advisor', name: 'AI Advisor', is_global: false },
    { key: 'api_access', name: 'API Access', is_global: false },
    { key: 'whatsapp_notifications', name: 'WhatsApp Notifications', is_global: false },
    { key: 'email_campaigns', name: 'Email Campaigns', is_global: false },
    { key: 'custom_roles', name: 'Custom Roles & Permissions', is_global: false },
    { key: 'audit_logs', name: 'Audit Logs', is_global: false },
    { key: 'multi_branch', name: 'Multi-Branch Support', is_global: false },
    { key: 'facial_recognition', name: 'Facial Recognition', is_global: false },
    { key: 'white_label', name: 'White Label', is_global: false },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }
  console.log(`Feature flags: ${flags.length} created`);

  // NOTE: No sample tenants seeded. Tenants are created when real gyms sign up.
  console.log('No sample tenants created (real tenants come from gym signups).');

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
