# Decisions taken autonomously

Choices made without being able to ask, with the reasoning. Anything here is
reversible — flag it if you disagree.

Format: **what** · why · where it lives.

---

## Pre-existing (agreed with you earlier, recorded for completeness)

- **uniwind, not NativeWind** — the only Tailwind-for-RN engine declaring
  React 19 / RN 0.81+, which is this stack. NativeWind 4 targets older RN and 5
  is preview.
- **Tokens mirror `frontend/`, not `member-app`** — primary is ink (#171717),
  red is reserved for destructive. Mapping primary to MuscleX red made
  "Collect payment" and "Delete" identical.
- **Role-adaptive tabs derived from the permission map, never the role name** —
  gyms author custom roles via `/settings/roles`, so a per-role table misses them.

---

## Autonomous session — 2026-08-26

### "No active plan", not "No plan", on the members list
`GET /members` includes `memberships: { where: { status: 'active' } }`, so a
lapsed member arrives with an **empty array** — indistinguishable from one who
never had a plan. "No plan" would tell a front-desk staffer there is nothing to
renew, the opposite of the truth for a lapsed member. The label states only what
the data supports. *Where:* `src/features/MemberRow.tsx`, covered by a test.

### Membership state is derived, not read from `member.status`
`status` describes the member RECORD (active/inactive); staff need to know
whether the PLAN is live. A member can be `status: 'active'` with a long-expired
plan. `membershipState()` derives Active / Expiring / Expired from `end_date`,
using a **14-day** expiring window to match the web app's renewal prompt.

### Search and status filters are sent to the API, not applied client-side
Only one page is in memory. Filtering locally would search 20 rows and report
"no matches" for a member who exists — the worst possible failure for a desk
lookup. Search is debounced 300ms. *Where:* `app/(tabs)/members.tsx`.

### Query keys exclude gym/branch ids
Keys are `['members', params]` with no tenant id. Tenant separation comes from
wiping the cache on sign-out / workspace switch / branch change, not from key
uniqueness — relying on keys would be one forgotten key away from a cross-tenant
leak. *Where:* `src/api/queries.ts`.

### Sign-out lives behind a confirm dialog and names its effect
Front-desk phones are shared. The dialog says the device forgets the session
*and cached gym data*, because that is what actually happens (the query cache is
cleared). *Where:* `app/(tabs)/more.tsx`.

### "More" entries: role hides, plan locks
Same asymmetry as the web app — a role-restricted module is absent, a
plan-restricted one is visible with its required tier. Inverting either leaks a
module or deletes the upsell.
