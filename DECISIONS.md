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

### Tab order: Home first, then Money before Schedule
`CANDIDATE_TABS` is one ordered list filtered by permission, so the order has to
serve every role at once. Final order puts Home first (every role opens to it)
and **Money before Schedule**, because front desk takes payments all day while a
trainer has no `payments` permission and therefore still lands on Schedule.
Result: front_desk → Home·Check-in·Members·Money, trainer →
Home·Check-in·Members·Schedule, accountant → Home·Members·Money·Reports.
Each is asserted in `src/__tests__/nav.test.ts`.

### Dashboard is `index` ("Home"); check-in moved to its own route
The first tab previously read "Check-in" while rendering a dashboard. Home is now
the dashboard and `app/(tabs)/checkin.tsx` is a separate screen.

### Dashboard is four independent queries, not one aggregate
KPIs, pulse, alerts and activity each render their own loading/error state, so a
slow or failing section (alerts touch several tables) cannot blank the screen.

### RowCard gained `titleLines`
Default stays 1 for scannable list rows, but alert rows put the whole message in
the title — clamping hid the thing the staffer needs to act on ("Vikram Kumar
(TG1028) — mem…"). Alerts use 3.

### Member detail shows payments/visits behind `<Can>`
A trainer has no `payments` permission, so the money section is absent for them
rather than empty. Role hides; it does not show an empty box that implies "no
payments exist".

### Call / WhatsApp / SMS helpers rather than showing a number to copy
These are the two things a front-desk staffer does with a member's number and a
genuine advantage over the web app. `normalisePhone` keeps a leading `+`:
dropping it turns an international number into a local one and silently dials
the wrong person (tested). iOS uses `telprompt:` so the OS confirms before
dialling; Android has no equivalent and uses `tel:`.
*Where:* `src/lib/contact.ts`.

### `scripts/tap-label.sh` for device automation
Reading coordinates out of `idb ui describe-all` and passing them through the
shell repeatedly hit word-splitting bugs. Tapping by accessibility label is also
stable across layout changes, where coordinates are not. It refuses off-screen
elements, which report a real frame but never respond.

### Own UUID v4 helper instead of adding `expo-crypto`
`crypto.randomUUID` does not exist in Hermes. Rather than take a new native
dependency (hard-gate #3) for one function, `src/lib/uuid.ts` implements RFC
4122 v4 and defers to the platform when it genuinely exists. `Math.random` is
adequate because these are idempotency and correlation keys — de-duplicating a
user's own retries — not secrets; anything security-bearing must use a CSPRNG.
Found because the backend rejected the old fallback with
"client_event_id must be a UUID".

### Check-in carries a client-generated idempotency key
A gym doorway has poor signal and staff double-tap. Without `client_event_id` a
retry records a second visit and can consume a second class credit. The key is
generated once per ATTEMPT and reused across retries.

### Check-in confirms rather than checking in on first tap
Two members frequently share a first name (the seeded data has two "Neha"s and
four "Vikram"s). Checking in the wrong member consumes their entitlement and
corrupts attendance, so the row tap opens a confirm that names the member and
states their membership standing.

### Money screen is wrapped in `<Can module="payments">` with a fallback
The tab is already hidden for roles without the permission, but a deep link
would still reach the route. Screens that show revenue guard themselves rather
than relying on navigation to keep people out.

### Calendar dates use LOCAL fields, never `toISOString()`
`toISOString().slice(0,10)` is UTC. Any evening east of Greenwich reports the
previous day, so the schedule marked one date on the calendar while listing a
different day's classes — which made every one of today's sessions render as
"Done". `toLocalISODate()` in `src/lib/format.ts` is now the single helper, used
by the calendar, the day filter and the query key so they cannot disagree.
Tested.

### Schedule is day-first, not week-first
A week grid is unreadable on a phone, and the question staff ask is "what is on
this day". Month calendar to pick, list below.

### Seeder resets via guarded `TRUNCATE ... CASCADE`
49 tables reference `members`, so ordered DELETEs silently failed (a child row
aborted the parent delete, and the next run collided on `member_code`). The test
gym owns its own schema, so TRUNCATE CASCADE is complete and scoped. A guard
refuses to run unless the schema name matches the test gym's own — it must never
touch `studio_template` or a real tenant.
