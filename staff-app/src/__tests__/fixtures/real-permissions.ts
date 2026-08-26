/**
 * REAL permission sets, captured from the running API on 2026-08-26.
 *
 * Every RBAC test in this app has so far used permission sets I invented. That
 * proves the gating LOGIC is right and says nothing about whether my
 * assumptions match what the server actually grants — and those assumptions
 * have already been wrong once (a trainer cannot record measurements; an
 * accountant has no `staff.*` at all, so PT sessions and Staff are invisible
 * to them).
 *
 * Captured with:
 *   POST /auth/login  →  user.permission_codes, for each seeded role account.
 *
 * If the server's role definitions change, these tests should FAIL and be
 * re-captured deliberately — that failure is the signal, not a nuisance.
 */
export const REAL_PERMISSIONS: Record<string, string[]> = {
  "owner": [
    "ai.create",
    "ai.view",
    "analytics.export",
    "analytics.view",
    "branches.create",
    "branches.delete",
    "branches.edit",
    "branches.view",
    "check_ins.create",
    "check_ins.delete",
    "check_ins.edit",
    "check_ins.export",
    "check_ins.view",
    "classes.create",
    "classes.delete",
    "classes.edit",
    "classes.export",
    "classes.view",
    "dashboard.export",
    "dashboard.view",
    "inventory.create",
    "inventory.delete",
    "inventory.edit",
    "inventory.export",
    "inventory.view",
    "marketing.create",
    "marketing.delete",
    "marketing.edit",
    "marketing.export",
    "marketing.view",
    "members.create",
    "members.delete",
    "members.edit",
    "members.export",
    "members.measure",
    "members.view",
    "organizations.create",
    "organizations.delete",
    "organizations.edit",
    "organizations.view",
    "payments.create",
    "payments.delete",
    "payments.edit",
    "payments.export",
    "payments.view",
    "reports.export",
    "reports.view",
    "roles.create",
    "roles.delete",
    "roles.edit",
    "roles.view",
    "settings.edit",
    "settings.view",
    "staff.create",
    "staff.delete",
    "staff.edit",
    "staff.export",
    "staff.view"
  ],
  "front_desk": [
    "branches.view",
    "check_ins.create",
    "check_ins.view",
    "classes.view",
    "dashboard.view",
    "inventory.create",
    "inventory.view",
    "members.create",
    "members.edit",
    "members.measure",
    "members.view",
    "payments.create",
    "payments.view",
    "reports.view",
    "staff.view"
  ],
  "trainer": [
    "ai.create",
    "ai.view",
    "branches.view",
    "check_ins.create",
    "check_ins.view",
    "classes.edit",
    "classes.view",
    "dashboard.view",
    "inventory.view",
    "members.measure",
    "members.view",
    "reports.view",
    "staff.view"
  ],
  "accountant": [
    "analytics.export",
    "analytics.view",
    "branches.view",
    "dashboard.export",
    "dashboard.view",
    "inventory.export",
    "inventory.view",
    "members.view",
    "payments.create",
    "payments.delete",
    "payments.edit",
    "payments.export",
    "payments.view",
    "reports.export",
    "reports.view"
  ]
};
