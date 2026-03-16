import { PrismaClient } from '@prisma/client';
import { PLAN_CONFIGS } from '../src/common/plan-configs';

const prisma = new PrismaClient();

async function seedPlans() {
  const count = await prisma.subscriptionPlan.count();
  if (count > 0) {
    console.log(`  → ${count} plans already exist, skipping`);
    return;
  }

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
        sort_order: i,
      },
    });
    console.log(`  → Created plan: ${config.display_name}`);
  }
}

async function main() {
  console.log('🌱 Seeding database...');
  await seedPlans();
  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
