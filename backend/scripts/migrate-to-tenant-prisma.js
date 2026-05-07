/**
 * Automated migration script: this.prisma.<model> → this.prisma.tenant.<model>
 *
 * Converts all service files to use the tenant-scoped Prisma client.
 * Only touches model-level operations (not $transaction, $queryRaw, $executeRaw).
 *
 * Run: node backend/scripts/migrate-to-tenant-prisma.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob') || (() => {
  // Fallback: use fs to find files recursively
  const results = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') walk(full);
      else if (entry.name.endsWith('.service.ts')) results.push(full);
    }
  }
  return { sync: (pattern) => { walk(path.dirname(pattern.replace('**/*.service.ts', ''))); return results; } };
})();

const SRC_DIR = path.join(__dirname, '..', 'src');

// All Prisma model names (PascalCase) that are in studio_template schema
const TENANT_MODELS = [
  'organization', 'organizationSettings', 'region', 'branch', 'branchSettings',
  'franchiseOwner', 'branchFranchise',
  'member', 'memberProfile', 'memberBodyStats', 'memberProgressPhoto',
  'memberNote', 'memberTag', 'memberTagAssignment', 'memberDocument',
  'memberReferral', 'membershipPlan', 'memberMembership', 'membershipFreeze',
  'familyMembership', 'familyMember', 'corporateAccount', 'corporateMember',
  'globalAccessPass', 'checkIn', 'classTemplate', 'studioRoom',
  'classSession', 'classBooking', 'classWaitlist', 'trainerAssignment',
  'classAttendance', 'classRecurringRule', 'class', 'classEnrollment',
  'role', 'rolePermission', 'staff', 'staffProfile', 'staffAvailability',
  'staffAttendance', 'trainerClient', 'trainerSession', 'payrollConfig',
  'trainerRevenue', 'staffShift', 'leaveRequest', 'payrollRecord',
  'trainerPerformanceRecord', 'auditLog', 'payment', 'expense',
  'notificationLog', 'campaign', 'lead', 'leadActivity', 'campaignAudience',
  'messageTemplate', 'automationWorkflow', 'workflowAction', 'referralProgram',
  'pushNotification', 'productCategory', 'product', 'inventory',
  'inventoryTransaction', 'supplier', 'purchaseOrder', 'purchaseOrderItem',
  'posSale', 'posSaleItem', 'productReturn', 'aiConversation',
  'ssoProvider', 'apiKey', 'memberInvoice', 'invoiceItem',
  'paymentGatewayConfig', 'refund', 'discount', 'taxRate',
  'financialTransaction', 'paymentRetryLog', 'dailyGymMetrics',
  'membershipAnalytics', 'revenueAnalytics', 'classAnalytics',
  'memberBehaviorAnalytics', 'trainerAnalytics', 'campaignAnalyticsRecord',
  'webhook', 'webhookDelivery', 'integration', 'featureFlag',
  'whiteLabelConfig', 'systemNotification', 'consentLog', 'dataRequest',
  'bookingTransition', 'providerAvailabilitySlot', 'bookingDispute',
  'serviceProvider', 'serviceCatalog', 'serviceBooking', 'review',
  'chat', 'chatMessage', 'notification', 'providerSubscription',
];

// Files to skip (already updated or not applicable)
const SKIP_FILES = [
  'prisma.service.ts',
  'tenant-prisma.service.ts',
  'tenant-prisma.extension.ts',
];

function findServiceFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...findServiceFiles(full));
    } else if (entry.name.endsWith('.service.ts') && !SKIP_FILES.includes(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = findServiceFiles(SRC_DIR);
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changes = 0;

  for (const model of TENANT_MODELS) {
    // Match: this.prisma.<model>. but NOT this.prisma.tenant.<model>.
    // Also NOT this.prisma.$transaction, this.prisma.$queryRaw, etc.
    const pattern = new RegExp(`this\\.prisma\\.${model}\\.`, 'g');
    const alreadyTenant = new RegExp(`this\\.prisma\\.tenant\\.${model}\\.`, 'g');

    // Count existing tenant references to avoid double-replacing
    const alreadyCount = (content.match(alreadyTenant) || []).length;
    const totalCount = (content.match(pattern) || []).length;
    const needsReplace = totalCount - alreadyCount;

    if (needsReplace > 0) {
      // Replace only non-tenant references
      content = content.replace(
        new RegExp(`this\\.prisma\\.(?!tenant\\.)${model}\\.`, 'g'),
        `this.prisma.tenant.${model}.`
      );
      changes += needsReplace;
    }

    // Also handle: tx.<model>. inside $transaction callbacks
    // These go through the $use middleware, so they're safe.
    // But we can add a comment for awareness.
  }

  if (changes > 0) {
    fs.writeFileSync(file, content);
    const relative = path.relative(path.join(__dirname, '..'), file);
    console.log(`  ${relative}: ${changes} replacements`);
    totalChanges += changes;
  }
}

console.log(`\nTotal: ${totalChanges} replacements across ${files.length} files.`);
console.log('Done! Run `npx tsc --noEmit` to verify TypeScript compilation.');
