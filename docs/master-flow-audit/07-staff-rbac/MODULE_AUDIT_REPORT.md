# Module 07 — Staff & Roles (RBAC) · Audit Report

**Date:** 2026-06-18 · **Branch:** `feat/per-gym-schemas`
**Status:** 🟢 AUDITED — healthy; no P0/P1. Minor dead-code/defense-in-depth notes.

Scope: RBAC resolution + assignment (`rbac.service`), role CRUD (`roles.service`/
controller), staff invite + permission overrides (`staff-invite.service`,
`staff.controller`). Skimmed: payroll, trainer, staff-biometrics.

## 1. Permission model
- **Where data lives:** `user_role` (who-has-what-role per studio) in the **public
  registry** (`pub`); `Role` + `RolePermission` + `StaffPermissionOverride` in the
  **tenant** schema (`tenant.client`).
- **Resolution chain:** `FINAL = (RolePermission ∪ ENTERPRISE_ROLES fallback ∪
  staff grants) − staff denials`, deduped. Fails safe (unknown role → `[]`).

## 2. Positives (verified)
- **No privilege escalation.** Every role/permission mutation endpoint is
  `@Roles('owner','brand_owner')` (or `@Roles('owner')`): `roles` create/update/
  delete, `PUT staff/:id/permissions`, `POST staff/:id/invite`,
  `PATCH staff/:id/branch-access`. A manager/front-desk/trainer cannot grant
  themselves permissions or assign the `owner` role.
- **Invite acceptance is safe.** Role, studio, branch, and permission overrides
  come entirely from the **owner-created invite record**; the invitee supplies only
  password + name (`staff-invite.service:200–292`). They cannot choose their role
  or escalate. `assignRole` takes `studio_id` from the invite (owner-controlled) —
  no cross-tenant assignment.
- **Role CRUD is tenant-isolated by construction.** `roles.service` does all
  by-id role/permission ops on the physical-schema `tenant.client`, so a by-id
  access can't reach another gym's role.
- **Override writes are gym-stamped** (`gym_id: invite.studio_id`) and keyed on
  `staff_id_permission_code` (idempotent upsert).

## 3. Findings

### 🟡 P2-M7-1 — Dead, unscoped role-removal methods.
`RbacService.removeRole(userRoleId)` and `removeAllRoles(userId, studioId)` operate
on the `pub` registry **by id with no studio guard** (`removeRole` is the R3
findUnique-by-id class). Grep shows **no callers anywhere** — they're currently
dead code, so not exploitable. *Recommendation:* remove them (hygiene), or if kept
for future use, scope `removeRole` by `studio_id` before wiring any endpoint, so a
future caller can't delete another gym's role by raw id. (Deleting code is a
CLAUDE.md hard gate → flagged, not removed.)

### 🟡 P2-M7-2 — `ENTERPRISE_ROLES` static fallback.
`resolvePermissions` falls back to in-code role definitions when a role has zero
`RolePermission` rows. Reasonable, but means permission seeding drift is masked at
runtime; ensure the seed (`rbac-seed.service`) stays authoritative so DB and code
don't silently diverge for a tenant.

## 4. Tests
- No dedicated RBAC unit suite found; the resolution chain (grants/denials/
  fallback) would be a high-value safety-net target.

## 5. Not-yet-covered
- `payroll.service` (salary — secret-field exposure rules), `trainer.service`,
  `staff-biometrics` not deep-audited. Salary scoping (owner/brand_owner only)
  should be re-confirmed under the StripSecrets interceptor in a later pass.

## 6. Completion status
🟢 **AUDITED — healthy.** No P0/P1. P2-M7-1 (dead unscoped removal methods) +
P2-M7-2 (seed authority) documented.
