# Security findings — 2026-08-26

> **STATUS: both findings FIXED and re-verified on 2026-08-26.**
> Fixes authorised by the repo owner (CLAUDE.md hard-gate #2 exception).
> The same requests that proved each issue now return `403`. See "Fixes applied".

Found while building `staff-app/` and testing against a seeded account on the
**development** Supabase project (2 studios, both test fixtures — not production).

Each finding below was **verified by making a real request**, not inferred from
reading code. Where I initially over-claimed, the correction is recorded, because
a security note that overstates is as harmful as one that misses.

---

## F-1 — `RolesGuard` lets gym owners satisfy every `@Roles(...)` check  · HIGH

**File:** [`backend/src/common/guards/roles.guard.ts`](../backend/src/common/guards/roles.guard.ts)

After checking the declared roles, the guard ends with a blanket bypass:

```ts
const adminRoles = ['super_admin', 'owner', 'brand_owner'];
if (adminRoles.includes(user.role)) return true;
```

`owner` and `brand_owner` are **per-gym tenant roles**, not platform roles. The
effect is that a gym owner passes *any* `@Roles(...)` decorator in the codebase —
including `@Roles('super_admin')`. The decorator stops expressing an actual
boundary.

**Verified.** Signed in as a seeded gym owner (`owner@mxtest.app`, studio
"MuscleX Test Gym") and called a controller declared `@Roles('super_admin')`:

```
GET /api/v1/admin/referrals/analytics/funnel
→ HTTP 200  {"total":0,"rewarded":0,"conversion_pct":0,"by_status":[]}
```

Expected: `403`.

**Why it matters here:** the team is already aware of the bypass and defends
individual money endpoints against it — `manualAdjustment` carries the comment
*"RolesGuard's owner bypass forces an explicit check here."* That is a per-endpoint
mitigation for a guard-level flaw, so every new endpoint is unprotected by default
and depends on an author remembering.

**Suggested fix:** drop `owner`/`brand_owner` from the bypass so it covers only a
genuine platform role, then re-check the endpoints that were relying on the bypass
to admit gym owners. This changes an authorisation boundary, so it needs a
deliberate review pass — see "Not fixed" below.

---

## F-2 — Platform referral rules are readable and writable by any gym owner · HIGH

**File:** [`backend/src/referrals/referrals-admin.controller.ts`](../backend/src/referrals/referrals-admin.controller.ts)

The controller is `@Roles('owner', 'super_admin')` and uses the **global**
`PrismaService` (`this.prisma`, 18 call sites) rather than `TenantPrisma`, so
there is no `gym_id` injection. Three wallet endpoints call `assertOwnStudio`,
but **19 do not**, including all of the referral-rule mutations:

```ts
@Post('rules')          createRule(@Body() dto: CreateRuleDto) { ... }
@Patch('rules/:id')     updateRule(...)
@Delete('rules/:id')    deleteRule(@Param('id', ParseUUIDPipe) id: string) { ... }
```

These take no `@CurrentUser` at all, so they cannot check who is calling.
Referral reward rules are **platform-wide**, so a single gym owner can alter or
delete the reward rules every gym is scored against.

**Verified (read).** As the same gym owner:

```
GET /api/v1/admin/referrals/rules
→ HTTP 200  [{"name":"Annual subscriber → +30 days", ...}]
```

Also reachable and unscoped: `GET /reward-logs` (`where: studioId ? {...} : {}`
— i.e. **every studio's** logs when the param is omitted), `GET /` , `GET /overview`,
`GET /analytics`, `GET /fraud-queue`.

I did **not** execute the destructive writes (`DELETE /rules/:id`) — read access
plus the absence of any check in the handler is sufficient evidence, and running
them would damage shared fixture data.

---

## Corrections to my own initial analysis

Recorded deliberately: I stated two things that turned out to be false, and the
verification step is what caught them.

- **"A gym owner can freeze or adjust any studio's wallet."** *Wrong.*
  `wallets/:studio_id`, `/freeze` and `/unfreeze` call `assertOwnStudio` — a
  cross-tenant read returned `403 "You can only access your own studio."`
  `wallets/manual-adjustment` has its own explicit `isSuperAdmin` check.
- **"Money endpoints are exposed."** *Wrong,* for the same reason. The exposure
  is to **configuration and cross-tenant reporting data**, not funds.

---

## Checked and found clean (web app)

- No `SERVICE_ROLE` / secret-shaped env in `frontend/src`; the only
  `NEXT_PUBLIC_*` values are legitimately public (Supabase anon key, Razorpay
  **key id**, Sentry DSN).
- No `dangerouslySetInnerHTML` anywhere in `frontend/src`.
- No client-supplied `gym_id` used as a query filter (the single `studio_id`
  parameter is the F-2 endpoint above, which is a backend authorisation issue,
  not a frontend one).

---

## Fixes applied

### F-1 — `roles.guard.ts`

The bypass is **kept for tenant-scoped routes and refused for platform-only
ones**. A census of every `@Roles(...)` in the codebase showed only 2 decorators
are `super_admin`-only, while 39 are `@Roles('owner')` *without* `brand_owner` —
so removing the bypass outright would have locked franchise owners out of their
own gyms. The narrow rule closes the escalation while leaving every mixed
decorator behaving exactly as before.

Covered by `backend/test/auth/roles-guard.spec.ts` (9 tests), including the
brand_owner-on-`@Roles('owner')` case that the naive fix would have broken.

### F-2 — `referrals-admin.controller.ts`

- `POST/PATCH/DELETE /rules[/:id]` now call a new `assertPlatformAdmin()`, the
  same pattern `manualAdjustment` already used. They also now take
  `@CurrentUser`, which they previously did not — they could not check the
  caller at all.
- `GET /reward-logs` is scoped to the caller's own studio. A tenant caller can
  no longer omit `studio_id` to read every studio, nor pass someone else's id.
  Platform admins keep the cross-tenant view for auditing.

### Verification (same requests that proved the issues)

| Request as gym owner | Before | After |
|---|---|---|
| `GET /admin/referrals/analytics/funnel` | 200 | **403** |
| `DELETE /admin/referrals/rules/:id` | unguarded | **403** |
| `GET /admin/referrals/reward-logs` | all studios | scoped to own studio |

Regression-checked that legitimate access still works: owner and `front_desk`
tokens both return 200 from `/members`, `/branches`, `/staff`.
Backend suite: 27 referral/guard tests pass, plus the 9 new guard tests.

## Still open

- The remaining unscoped reads on `referrals-admin` (`GET /`, `/overview`,
  `/analytics`, `/fraud-queue`) return platform-wide aggregates to gym owners.
  They were empty in dev so the exposure is **unproven but real by code
  reading** — they use the global `PrismaService` with no studio filter. Fixing
  them properly means deciding what a gym owner *should* see of their own
  referral funnel, which is a product question, not a mechanical one.

---

## F-3 — `StripSecretsInterceptor` destroyed class instances (data-integrity, not a leak)

**File:** [`backend/src/common/interceptors/strip-secrets.interceptor.ts`](../backend/src/common/interceptors/strip-secrets.interceptor.ts)

Found while building the mobile POS screen. Not a security hole — secrets were
always stripped correctly — but a correctness bug in the same shared code path,
affecting **every** response.

`strip()` rebuilt every object with `Object.entries`. `isPlainObject` dodged
`Date` and `Buffer` **by name**, so every other class was flattened. Prisma
returns `Decimal` for numeric columns, so a price left the API as its internal
representation:

```json
{"product_name":"Creatine 250g","price":{"s":1,"e":3,"d":[1400]}}
```

**Both clients break on that.** `frontend/src/features/inventory/components/BundleDialog.tsx`
does `Number(p.price)` → `NaN` → renders `₹NaN`; the staff app rendered `—`.
It survived because money columns are inconsistent — `payments.amount` is an
`Int` (unaffected) while `products.price` is a `Decimal` — so only some screens
show it.

**Fixed** by testing the prototype instead of listing classes to dodge:

```ts
const proto = Object.getPrototypeOf(v);
return proto === Object.prototype || proto === null;
```

This covers Decimal, Date, Buffer and anything added later. Secret-bearing
fields live on plain Prisma row objects, which are still walked.

**Verified:** `price` now serialises as `"1400"` (the string form the web app's
`Number()` already expects), `salary`/`base_salary` are still absent for a
non-owner caller, and the POS screen renders ₹1,400. Regression test added to
`backend/test/strip-secrets.interceptor.spec.ts` (10 tests pass).

I deliberately did NOT change the wire format to a JSON number — that would be
a broader behavioural change than the bug required.

---

## F-4 — Class attendance and PT-session updates were unusable (FIXED)

**Severity:** high availability defect; not a data leak.
**Found:** 2026-08-26, while building the trainer register (Phase 6).

### What was wrong

Four call sites gated access by comparing an **organisation** id against the
caller's **studio** id:

```ts
if (session.branch.organization_id !== studioId) {
  throw new ForbiddenException('Access denied to this session');
}
```

`Branch.organization_id` and `StaffUser.organization_id` are both **nullable**,
and are null for every single-org gym — which is the default shape. So the
comparison was `null !== '<studio uuid>'`: always true, always Forbidden.

Affected:
- `classes/attendance.service.ts` — `markAttendance`, `getSessionAttendance`,
  `completeSession` (all three)
- `staff/trainer.service.ts` — `updateSession`

That is the entire class-register feature and PT-session completion.

### Verified, not inferred

Against the seeded gym, before the fix:

```
GET /api/v1/classes/bookings/attendance/<own session>   (owner's own token)
→ {"message":"Access denied to this session","statusCode":403}
```

After: `200` with the attendance summary.

### The fix

Compare `gym_id`, the tenant key this system actually scopes on
(`backend/src/prisma/tenant-models.ts`). The check remains a real boundary —
another gym's session is still refused, which is asserted directly in
`test/classes/attendance-tenant-check.spec.ts`.

### Why it survived

`test/staff/pt-session-rate.spec.ts` mocked the trainer with
`organization_id: 'studio-1'` — a shape the production database never produces
for a single-org gym. **The test encoded the bug**, so the suite was green
while the feature was unreachable. The mock now carries `gym_id`.

Worth generalising: a mock whose shape cannot occur in production will happily
prove that broken code works.

### Note on a related, NOT-broken thing

`classes/booking.service.ts#getSessionBookings` uses `findUnique` by id with no
explicit gym filter, and its controller takes no `@CurrentUser`. I checked
this and it is **safe**: the Prisma extension post-checks `findUnique` results
against the tenant and forces `gym_id` into the projection so the guard cannot
be skipped by a narrow `select` (`prisma.service.ts`, the R3 fail-closed path).
Recording it so the next person does not re-open it.
