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

### Money is `number | string` on the client, coerced in the formatter
The API is inconsistent: `payments.amount` is an Int, `products.price` is a
Prisma Decimal that serialises to a string. `toAmount()` in `src/lib/format.ts`
coerces both, so no caller has to know which column type it is reading, and junk
renders as "—" rather than "NaN". Tested.

### POS is reachable from the More hub
Front desk has `inventory.create` but POS sits 6th in tab priority, so it never
made the 4 primary slots — the till was unreachable. The More hub now links to
real routes as well as listing unbuilt ones.

### Add-member form is deliberately short
Only the DTO's required fields plus the two the desk always has to hand
(email, gender). DOB, emergency contact and address are left to the web app —
a long form at a busy counter is how members get entered badly or not at all.
On success it navigates straight to the new member, so the next action (take
payment, check in) is one tap rather than a search.

### "Add" is gated on `members.create`
A trainer can view members but not add them, so the button is absent for them
rather than failing on submit.

### Collect payment pre-fills the plan price but stays editable
The common case is "they are paying for their plan", so the amount is pre-filled
from the current membership. Part-payments are normal at a counter, so the field
remains editable. It re-prefills on every open — a stale amount carried over from
a previous member would be dangerous.

### `POST /payments/cash` covers card and UPI too
Despite the name, the endpoint's DTO accepts cash/card/upi/bank_transfer.
"Cash" here means *recorded manually* as opposed to arriving via a gateway
callback.

### Seeder creates `inventory` rows, not just products
Stock lives in a separate `inventory` table keyed by product + branch. Seeding
products alone produced a shop that looked fine but could not sell anything —
the API correctly rejected every sale with "Insufficient stock". One product is
seeded at zero stock deliberately, so that path stays exercised.

---

## 2026-08-26 — Offline cache: how tenant isolation survives a restart

**Decision.** Persist the React Query cache to expo-sqlite, scoped per session,
with THREE independent barriers between one gym's data and another's.

**Why it needed a decision at all.** In memory, "clear the cache on workspace
switch" is sufficient: the process boundary does the rest, and a missed wipe is
a window measured in seconds. On disk the cache outlives the process, so a
missed wipe is permanent until something overwrites it. That is a different
risk class, and `CLAUDE.md` names cross-tenant leakage as the worst outcome in
this system.

So isolation deliberately does not rest on the wipe alone:

1. **Scope key** — each session's blob is stored under a row key derived from
   gym + branch + user. Another session reads a different row.
2. **Buster** — react-query discards a restored cache whose buster does not
   match, before hydrating. Same derivation, checked independently.
3. **Sweep** — every scope change deletes every other row, so at most one blob
   exists on disk at a time.

(1) and (2) are belt-and-braces on purpose. (3) is the one that depends on app
code running at the right moment, which is exactly what breaks quietly.

**Branch is treated as a data boundary**, not just gym. A staffer switching
from one site to another must not see the previous site's member list.

**Allowlist, not denylist**, for what persists: `dashboard`, `members`,
`schedule` — what the plan promises offline, nothing more. The default has to
be "does not touch disk", because forgetting to EXCLUDE something fails
silently while forgetting to INCLUDE something shows a visible, harmless
"no connection".

**12-hour max age.** Not a comfort setting: a membership that lapses overnight
would otherwise still read "active" at the door next morning and the desk would
wave that person through. Twelve hours spans one shift and never two.

**No `@tanstack/query-async-storage-persister`.** The `Persister` interface is
three methods; implementing it directly over expo-sqlite avoided a dependency.

**No NetInfo.** Detecting "offline" properly in RN needs
`@react-native-community/netinfo`, which was not approved. Offline is inferred
instead from "a query is failing but we hold data" — which is the condition we
actually care about, and needs no dependency.

## 2026-08-26 — DataList precedence changed to data > error > empty

Offline caching exposed a flaw in `DataList`: it rendered `ErrorState` whenever
`error` was set, so a failed refetch on top of a hydrated cache would blank a
list that was fine a second earlier — discarding the best information the
building has, precisely when the network is worst.

Rows now win over errors, with a `StaleBanner` saying the data is saved and how
old it is. `error > empty` is unchanged: a failed request must never read as
"this gym has no members".

The banner is deliberately plain rather than alarming. In a basement gym this
is a normal condition, and staff who see a red error ten times a day stop
reading it.

## 2026-08-26 — QR scanning auto-submits; manual search still confirms

The asymmetry is intentional. A scanned code carries an HMAC-signed member id —
there is nothing to disambiguate, and a confirm tap on every scan would make
the queue slower than typing. A searched row was picked out of a list of
similar names, where the wrong pick consumes someone's entitlement and corrupts
attendance.

**`ScanGate` is the load-bearing part.** `onBarcodeScanned` fires ~10x/second,
so a card held in frame for two seconds is twenty check-ins. `client_event_id`
does NOT help here — each fire is a fresh attempt with a fresh key, so
idempotency never sees a duplicate. The duplicate has to be stopped before it
becomes a request. Cooldown is per-code so one member's cooldown never blocks
the next person in the queue.

Failures are classified: 4xx is a verdict about the CARD and will not change on
a re-scan (revoked, wrong gym, already used), so the code stays in cooldown.
Anything else is about the moment, so it is immediately re-scannable.

**The scanned string is never parsed client-side.** Signature, gym and replay
nonce are all checked server-side, and the client holds no signing secret — any
leniency invented here would silently become the real check.

## 2026-08-26 — Offline check-in queues; offline QR does not

`POST /check-ins/sync` already existed and is well-suited: it takes an
`occurred_at`, accepts a client-minted idempotency key, and returns PER-ROW
outcomes with a `retryable` flag rather than a single count. The client mirrors
that design instead of inventing its own.

**Only search-based check-in can queue.** `OfflineCheckInDto.member_id` is
required, so a queued row must carry a resolved member id. A scanned token
resolves to a member only via HMAC verification the server performs, and the
client holds no signing secret — decoding it locally to extract `mid` would
mean trusting an unverified payload, which is exactly the leniency that becomes
the real check. Offline, the scanner therefore directs staff to search by name,
where the member id comes from the cached member list.

**Rows are stamped with their gym and only flushed under a matching session.**
Flushing gym A's queue under gym B's token would push A's member ids into B's
audit trail. The filter is applied in SQL, not after loading, so a later
refactor cannot quietly drop it; a session change purges other gyms' rows
outright. Stated as a test: "NEVER sends another gym rows".

**A policy denial is dropped, not retried.** "Membership expired" is a final
answer; keeping it would wedge the queue behind a row that can never succeed.
Only transient failures are kept, with a 25-attempt backstop.

**Only network-class failures queue.** A 4xx is the server refusing this
check-in — queueing it would promise the staffer it goes through later when it
never will, which is worse than saying so while the member is still standing
there.

**Foreground-triggered, not polled.** The signal we have is "the staffer picked
the phone up", which correlates with walking back into range and costs nothing
while the phone sits on the counter. Proper connectivity detection needs
NetInfo, which is not an approved dependency.

## 2026-08-26 — Seeder wrote a payment status that does not exist

The test gym's dashboard showed **Revenue this month ₹0** while holding thirty
payments. Not an app bug and not a backend bug: my seeder wrote
`status = 'completed'`, and every revenue query in the system — dashboard KPIs,
financial reports, billing — filters on `status = 'paid'`.

`'completed'` is not a payment status this system has. The set is
`pending | paid | refunded | failed`, and `'completed'` appears nowhere in
`backend/src/payments`. Every other gym in the database uses `'paid'`.

Fixed in the seeder, and the thirty existing rows corrected in place (scoped to
the test gym's own schema, behind the same name guard the seeder uses) rather
than re-seeding, which would have truncated the check-ins recorded since.

Worth recording as a pattern: seed data that uses a value the product never
produces makes the product look broken. The dashboard was correct the whole
time. I nearly went looking for the bug in the KPI query.

## 2026-08-26 — Offline check-in verified end to end, and the gap it exposed

Verified on device against the real backend by pausing the API process
(SIGSTOP, so requests hang exactly as they do on a live wifi with a dead
uplink, rather than failing fast):

- Dashboard rendered entirely from the persisted SQLite cache, **through a full
  app restart with the API down**.
- Member search fell back to the on-device roster and found six Patels.
- A check-in taken offline was queued: "1 check-in waiting to sync".
- On foreground with the API back, the queue drained and the banner cleared.

The server refused that particular row with `reason: "cooldown"` — the member
had genuinely checked in 36 minutes earlier — which is correct behaviour and
exercised the non-retryable path properly.

**But it exposed a real gap.** The staffer had been told "Saved — will sync when
back online", and the row was then dropped silently. The gym's attendance would
be wrong and the one person who could have corrected it, standing right there,
would never know. Flush now returns the refused rows, `OutboxProvider`
announces each one, and `synced` counts only rows that actually landed —
reporting "1 synced" for a rejected row is the same silent lie.

Reason codes are translated for the desk: "cooldown" is meaningless to them,
"already checked in recently" answers the question they actually have (is the
visit on record anyway?).

## 2026-08-26 — Two fixes that only surfaced by testing offline properly

**No request timeout.** `fetch` had no deadline, so the common gym failure —
associated to the wifi, uplink dead — hung indefinitely rather than failing.
The check-in button would spin forever and the offline queue would never get
its chance. Added a 12s default, surfaced as status 0 so callers treat it
identically to any other "no response".

**`retry: 1` doubled every timeout.** Falling back to the offline path took ~35
seconds with a member standing at the counter. The client has already waited
its full deadline to conclude the network is not answering; retrying spends it
again. Timeouts are no longer retried (~13s now). A 5xx still retries once —
the connection worked, so another go is cheap.

## 2026-08-26 — Offline search needs a cached roster

Member search is server-side, so with no uplink the desk could not find the
person in front of them — which made the offline check-in queue unreachable and
therefore pointless. A 500-member roster (the server's own clamp) is now
fetched and persisted deliberately, and searched locally when the server does
not answer. The server stays authoritative whenever it responds.

Local matching uses two minimums: **2 characters for names, 3 for identifiers**.
Member codes share a prefix and a run of zeroes, so "00" is a substring of
nearly every code and phone in the building — matching those loosely returns
the whole roster, which looks like it worked while being useless.

## 2026-08-26 — Kiosk mode (Phase 5b)

Reuses the check-in module rather than reimplementing it: same scanner, same
mutation, same offline queue. The differences are all consequences of the
device being **unattended and public**.

**No staff context on screen.** No greeting, no branch switcher, no nav. A
queue of members should not be reading the name of whoever signed the tablet
in.

**Branch is pinned to the DEVICE, in the Keychain — not taken from the
session.** A tablet at the Andheri door must keep recording Andheri visits even
if somebody switches branch on another screen, and it must survive a reload.

**Leaving requires a PIN, and that is the real security boundary here.**
Check-in is deliberately open to anyone walking past. The way *out* is not:
whoever exits has every member's phone number, the payment history and the
till. The PIN is stored in SecureStore (the iOS Keychain) rather than hashed —
a 4-digit space is trivially brute-forced from a hash, so hashing would buy
nothing while implying a protection that is not there. What actually protects
it is the Keychain plus a 5-attempt limit. It is **not** a second auth factor;
the server's boundary is still the staff JWT.

**No exit PIN configured means it refuses to exit**, rather than falling open.
A kiosk whose lock was never set up is not thereby unlocked.

**The exit is an unlabelled long-press on the top-left corner.** A visible
"Exit" button on a lobby tablet is an invitation. But staff must never be
locked out of their own device either, so the setup screen states plainly where
it is and suggests trying it once before walking away, and the target is
generous (120pt, two seconds).

**iOS Guided Access and Auto-Lock are device settings, and the app does not try
to enforce them.** The setup screen gives the exact steps instead. An app that
fought the OS here would lose and confuse people on the way.

### Verified on device

Setup (branch pinned, PIN set) → kiosk live with no chrome → long-press →
PIN screen → wrong PIN gives "Incorrect PIN. 4 attempts left." → correct PIN
returns to the dashboard.

### One bug this found

The scanner's `onClose` was mandatory, so the kiosk passed a no-op — rendering
a **"Search by name" button that visibly did nothing**, and offering a staff
action to a member. `onClose` is now optional and the button is omitted
entirely when there is no way out.

## 2026-08-26 — Class register (Phase 6 start)

The trainer's core daily task. Three decisions worth recording:

**Every mark saves immediately; there is no submit button.** A trainer marks
the register while people walk in, putting the phone down between arrivals. A
batched form that lost its marks when the app was backgrounded mid-class would
lose them silently, and the class is over by the time anyone notices.

**Bookings and attendance are separate tables behind separate endpoints, so the
client joins them.** `class_bookings` is who signed up; `class_attendance` is
who turned up, and `/classes/bookings/session/:id` carries only the former. I
built the screen without the join first and caught it on device: the mark
reached the database correctly while the row still read "Not marked". A
trainer would mark the same person twice, or conclude the app is broken.

**The register is sorted by name, client-side.** The API orders by `booked_at`,
and a class booked in one batch has ties Postgres breaks arbitrarily — so the
same roster came back in a different order each fetch and rows jumped under the
trainer's finger. Name is also simply how you find somebody; nobody looks a
member up by when they signed up.

`'registered'` counts as UNMARKED. The server writes it at booking time, so
treating it as a decision would show a complete register before the class
started.

### Two bugs this found

**Schedule was unreachable for front desk.** Only `MAX_PRIMARY_TABS` (4)
candidates fit in the tab bar; Schedule sits 5th, so a front-desk user had
`classes.view` and no route to the screen at all. POS had the identical problem
and had been fixed by hand with a comment explaining it — but nothing stopped
the next tab repeating it. `src/__tests__/nav.test.ts` now asserts the
*property*: every candidate tab is either primary or reachable from More.
Matching is by MODULE, not href — Marketing and Reports live at their own
`/more/*` routes and a path comparison reported them as missing when they were
not.

**The seeder wrote `enrolled_count` with no bookings behind it**, so the
schedule claimed "10 of 20 booked" while the register showed nobody. Same class
of defect as the payment-status one: seed data that disagrees with itself makes
working code look broken. The seeder now books real members and derives the
count from them; existing sessions were backfilled non-destructively (394
bookings, 230 attendance rows) rather than re-seeding, which would have
truncated the check-ins recorded by hand during testing.

## 2026-08-26 — Schedule fetches a month, not a day

The calendar's caption said "Dots mark days with activity", and it could only
ever dot the selected day — whose dot is hidden under the selection highlight
anyway. So a gym with classes every weekday showed a calendar with no dots.

The old query asked for `limit: 200` and filtered client-side to one day,
throwing the rest away. Two problems: the caption was a promise the data could
not keep, and a busy gym would silently fall off the end of the 200.

`/classes/sessions` takes `date_from` / `date_to`, so the month on screen is
now exactly what is fetched, and both the day's list and the whole month's dots
come from that one response — strictly less data than before, and correct.

The visible month is tracked separately from the selected day: paging ahead
loads that month without moving the selection, which is what a calendar is for.

Grouping is by LOCAL day on both sides. `start_time` is a UTC instant, and
slicing its ISO string files a 10pm class under tomorrow — the same bug already
fixed once in this screen.

## 2026-08-26 — Class bookings from the register

Walk-ins are the common case: somebody turns up who is not on the list.

**No client-side capacity check before booking.** The server claims a seat with
a guarded `updateMany` that only increments when a place is genuinely free, so
two staff booking the last spot at once cannot overbook — the loser falls to
the waitlist. A capacity check here would re-open exactly the race the server
already closed, and would be wrong the moment somebody books from the web.

**"Booked" and "waitlisted" are reported differently.** The server sends a full
class to the waitlist rather than refusing, and those are different news for
somebody standing in the doorway.

**Members already booked are NOT filtered out of the search.** The server
rejects a duplicate with a clear conflict; hiding them would mean a trainer
searching for someone finds nothing and concludes they are not a member —
a worse answer than "already booked".

**Removing a booking is refused once attendance is marked, and says why.**
Cancelling would drop the recorded fact that the member attended. Refusing
silently would have been worse than refusing.

Verified on device: booked Neha Patel into Power Yoga (3 → 4, real row in
`class_bookings`, `enrolled_count` incremented atomically), then removed her
via swipe (4 → 3, `booking_status = 'cancelled'` — a soft delete, so the audit
trail survives).

## 2026-08-26 — Member progress (Phase 6)

What a trainer opens mid-session. Weight carries the chart because it is the
number gyms actually record every time; the rest read as latest-plus-change,
which is how a trainer talks about them ("waist is down 3cm since March").

**Every numeric field arrives as a Prisma `Decimal` serialised to a STRING**
(the columns are `numeric`), so nothing assumes `number`. This is the same
defect that shipped `₹NaN` to the web app — fixed server-side there, but a
client doing arithmetic on `"72.5"` is making the same assumption from the
other end.

**A metric with one reading shows "first reading", not "0.0".** Those are
different facts. Showing 0.0 tells a member their training achieved nothing
when the truth is nobody has measured them twice.

**Records missing a metric are dropped from its series, not zero-filled.** A
gym that weighed somebody but did not measure their waist has no waist datum;
plotting 0 invents a collapse that never happened.

**The change tint follows the METRIC, not the sign.** Down is good for weight,
body fat, waist and hips; up is good for muscle, chest and arms. Colouring
every decrease green would congratulate a member on losing muscle. Verified on
device: +9cm chest reads as progress, −3cm arms does not.

**Blank inputs are omitted, not sent as 0** — recording a member as weighing
nothing because the trainer only measured their waist.

The seeder now gives roughly a third of members a six-month history, drifting
in a plausible direction rather than randomly. Not everybody: a gym where every
member has six months of body-fat readings is not one anyone recognises, and
the empty state deserves exercising too.

## 2026-08-26 — PT sessions (Phase 6)

**`trainer_id` is the STAFF row id, not the auth user id the session carries.**
`staff.id` and `staff.user_id` are different columns, and passing the auth id
makes the API answer "Trainer not found". POS had already hit this and solved
it with `useCurrentStaff`, so PT sessions reuse that rather than inventing a
second lookup.

**The request is held until the staff row resolves.** Firing "show me mine"
before it lands would send no `trainer_id` at all and quietly return the whole
gym's sessions labelled as the trainer's own — a wrong answer that looks
exactly like a right one. (I first bodged this with a `'__pending__'` sentinel
trainer id; that sends junk to the API, so it is now a proper `enabled` flag.)

**Mine-vs-Everyone is a visible toggle, not a hidden default.** A manager
opening this screen wants the opposite of what a trainer wants, and neither
should have to guess which list they are reading. It defaults to "Mine" for the
trainer role and "Everyone" otherwise.

**Completing a session is gated on `staff.edit`, which a trainer does NOT
have.** That is correct rather than unfortunate: completing a session books
trainer revenue and commission priced off the gym's configured rate, so it is a
money-moving action. The trainer can see their schedule (`staff.view`); a
manager settles it.

**A no-show is warning-toned, never destructive-red.** A missed session is a
normal fact of gym life that the trainer records, not a mistake they made — and
a screen that shouts every time somebody oversleeps stops being read.

## 2026-08-26 — Training: plans and exercise library (Phase 6)

**Read-only, deliberately.** Authoring a plan needs `members.create`/`edit`,
which the trainer role does not have — the same permissions question as
measurements (TODO_FOR_ME item 7). Building an editor the primary user cannot
open would be work aimed at nobody, so this ships as the reference a trainer
actually uses on the floor, and the editor waits on that decision.

**A plan is a SEQUENCE, so it is sorted by `position`** rather than by whatever
order the API returned. Squats before the finisher. Showing it shuffled turns a
prescription into a list of suggestions. The circle shows the prescribed
position, not the array index.

**The prescription line omits what was not prescribed.** "3 × 10 @ 0kg" reads
as an instruction to lift nothing; "3 × 10" reads as the truth. Weight arrives
as a Prisma Decimal string, so it is coerced before the zero check — otherwise
`"0" > 0` is false for the wrong reason and junk like `"heavy"` would render
as `NaN`.

**Exercises are filtered server-side by muscle group**, not fetched whole and
hidden client-side. The library grows per gym, and "download everything then
show a tenth of it" is the habit that makes a list slow on the mid-range
Android phones front-desk staff use.

**Test data came from the product's own `POST /exercises/seed-defaults`**
(50 exercises) rather than hand-written SQL, so the library matches what a real
gym gets on day one. Three plans and nine assignments were then created through
the public API for the same reason.

## 2026-08-26 — AI advisor deferred (blocked, not skipped)

`POST /ai/chat` returns 500: no LLM API key is configured for this environment
(`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are absent from `backend/.env`).

I did not build a chat UI against it. An interface I cannot exercise even once
is unverified code that looks finished, and this one's whole behaviour is the
model's response — there is nothing meaningful to check without a key. Logged
as TODO_FOR_ME item 8 instead. `GET /ai/conversations` works and returns empty,
so the surface is otherwise reachable when a key exists.

## 2026-08-26 — Sheets are portalled (a real bug, and a wrong first fix)

**The bug.** The branch switcher's sheet rendered clipped against the TOP of
the dashboard, leaving the branch list unreachable. A bottom sheet lays out
where it is *written*, and `BranchSwitcher` renders its sheet inside the
dashboard's ScrollView — so it appeared at the component's scroll offset rather
than the bottom of the window. Every other sheet in the app worked only because
I had mounted each one as a screen-root sibling, a constraint I had written
down as a caveat rather than removed.

**The fix.** `Sheet` now portals to the app root via `@rn-primitives/portal` —
the same host that already carries dialogs and popovers, proven working on
every `verify:ui` run. Callers no longer have to remember where to mount a
sheet, so the whole class is gone.

**The wrong first attempt, recorded because it cost real time.** I first
reached for `BottomSheetModal` + `BottomSheetModalProvider`, which is the
library's own answer to this. It never presented — no error, just nothing.
Rather than keep guessing at it I switched to the portal host that was already
demonstrably working here.

**And a self-inflicted crash on the way.** I put `if (!open) return null;`
ABOVE a `useCallback`, which threw "Rendered more hooks than during the
previous render" and took the screen down. The early return now sits below
every hook, with a comment saying why. Two lessons: the device told me exactly
what was wrong the moment I actually looked at the screen instead of the
harness output, and a red error screen reads identically to "the sheet didn't
open" if you only check whether an element exists.

## 2026-08-26 — Harness: drag, do not flick

`verify:ui`'s scroll used a fast 500pt swipe, which imparts momentum and
travels ~1000pt — sailing past its target so the search loop oscillates. That
is what broke the Dialog step: widening the flick earlier to reach the filter
sheet traded one miss for another.

It now drags over 1.1s, which moves roughly the gesture distance and no more.
`find_center` also prefers an EXACT label match, the same fix `tap-label.sh`
needed — otherwise 'Dialog' can find 'Alert Dialog'.

## 2026-08-26 — Expenses (Phase 8)

**The summary endpoint requires a branch and 400s without one**, while the list
spans branches happily. On "All branches" the tiles are hidden and the screen
says why, rather than firing a request that can only fail — an error card where
a number should be teaches staff to ignore the row.

**Recording refuses without a single branch selected.** The DTO requires
`branch_id`; guessing one would file a Bandra expense against Andheri, which is
worse than refusing.

**No edit, by design.** Expenses are append-only server-side (modelled as
events), so a correction is a new entry — which is what an auditable ledger
wants.

Test data was created through the public API (6 categories, 10 expenses across
three months) rather than raw SQL, so it went through the same validation a
real entry does.

## 2026-08-26 — Reports (Phase 8)

**Headline numbers are gym-wide; the P&L needs a branch**, because that is how
the API divides them (`/financial-reports/dashboard` takes none,
`/financial-reports/monthly` requires `branch_id`). Rather than hide that
inconsistency the screen shows what it can and says plainly what the branch
switcher would unlock.

**A loss is shown in plain ink, not alarm red.** The seeded gym is ₹2.38L down
this month and that is exactly the number an accountant opened the screen to
find. Colouring it as an error would imply they did something wrong, and a
back office that shouts at its user stops being read.

**Category bars are relative to the LARGEST category, not to total spend.**
Against the total, everything except rent and salaries is an invisible sliver
and the chart says nothing. Against the largest, the shape of the month is
legible.

**`titleiseSlug` extracted to lib/format.** I had reused `describeMuscleGroup`
for expense category slugs — it produced the right string by accident, which is
how confusing code gets written. The API sends snake_case enums everywhere
(expense categories, muscle groups, session types); one helper now knows how to
say them out loud, in sentence case rather than Title Case because these read
inside sentences and table rows.

## 2026-08-26 — Inventory (Phase 8)

Read-only: `inventory.edit` is manager-level, and the accountant who most wants
this screen has `view` + `export` only.

**"Needs attention" is the default view**, because the question staff bring to
this screen is "what am I about to run out of", not "list everything".

**A product with NO inventory row is not a product with zero stock.** They are
counted and worded separately — "Stock not tracked" versus "Out of stock". This
is not hypothetical: the seeded shop had eight products and no inventory rows,
so every POS sale failed with "insufficient stock" while the shop screen looked
perfectly stocked. Conflating the two is what made that take so long to
diagnose.

**Reserved stock is subtracted from available.** Counting it is how a shop
promises the same tub of protein to two people.

**No reorder level means nothing is "low".** Inventing a threshold would nag
about every product a gym deliberately stocks lightly.

**Untracked gets a sentence, not a tile, and only when non-zero.** It is a
setup gap rather than a sales problem, and for most gyms it is permanently
zero — a tile that always reads 0 trains people to skip the whole row. Two
tiles rather than three, because three across a phone wraps every label.

## 2026-08-26 — Staff list (Phase 10 start)

**Salary is never rendered, even to an owner who is entitled to receive it.**
`StripSecretsInterceptor` correctly sends `salary` to owner/brand_owner and
withholds it from everyone else — verified per role against the running API
(owner: present; accountant and trainer: absent; `face_descriptor` and
`face_vec` absent for all). But a manager glancing at a shared phone in a staff
room should not be how a gym's pay scale gets around. Payroll is its own
permissioned screen in Phase 11.

**Tapping a row calls the person.** On a gym floor the reason you open the
staff list is almost always to reach somebody. A row with no number is
deliberately not pressable, so it does not look tappable and then do nothing.

**Read-only.** Hiring and editing are `staff.create`/`edit` and belong with
payroll in Phase 11.

Worth noting: Staff and PT sessions are correctly INVISIBLE to the accountant,
who holds no `staff.*` permission at all. I briefly mistook that for a
navigation bug before checking the permission set.

## 2026-08-26 — A second harness: does every screen actually mount?

`verify:ui` proves dialogs, sheets and toasts work. It says nothing about
whether a screen mounts at all — and when a rules-of-hooks mistake took the
Sheet down, it reported "sheet did not open" while the device was showing a
full-screen red **Render Error**. A missing element and a crashed screen looked
identical to it.

`npm run verify:screens` closes that: it walks every screen and asserts, first,
that the tree contains no render-error text, and second, that something only
that screen renders is present. Order matters — a crashed screen can still
contain the label you were looking for.

**It found a real bug on its first run.** The More entry for Reports pointed at
`/more/reports`, a route that was never created, while the real screen lives at
`/(tabs)/reports`. Reports is 8th in `CANDIDATE_TABS`, so an owner — whose four
tab slots are taken by earlier candidates — had **no way to open Reports at
all**. The existing reachability test missed it because it matches by MODULE:
the module was listed, the href was simply wrong. `nav.test.ts` now also
asserts that every built entry points at a route file that exists.

**Three of its early "failures" were my assertions, not the app**, and each
taught the script something:
- A generic "Back" fails for Schedule and POS, which are TAB routes reached
  through More and have no back button.
- Placeholders surface as `AXValue`, not `AXLabel`, so asserting on placeholder
  text never matches.
- Asserting a fixed tab bar tests the fixture, not the app — which tabs exist
  depends on the role.

**And one was genuine flakiness worth fixing properly.** Fixed sleeps made the
FIRST entry after opening More fail intermittently, and *which* entry failed
moved between runs. A moving failure is almost always the harness. It now waits
for a label rather than guessing a duration.

## 2026-08-26 — Membership plans (Phase 10)

Opened mid-conversation with somebody deciding whether to join, so it answers
the question actually asked: **not just the headline price, but what that works
out to per month.** A desk comparing ₹2,400 monthly against ₹24,000 annual
should not be doing division in front of the customer. Gold reads "1 year ·
₹1,973/mo".

**The per-month figure is suppressed when it equals the headline** — "₹2,400 ·
₹2,400/mo" on a monthly plan is noise.

**"365 days" is never shown.** Nobody sells an annual membership that way, so
clean multiples convert to weeks, months and years; awkward lengths stay in
days rather than being rounded into a lie.

**No duration means no monthly figure**, rather than an invented one.

**Retired plans sort last but are not hidden.** A member may still be on one,
so the desk needs to see it — but it must never be the thing offered to
somebody joining today.

**`/membership-plans` returns a bare ARRAY**, not the `{ data, total }`
envelope most list endpoints use. Unwrapping it like the others yields
`undefined` and an empty screen that reads as "this gym sells nothing" — noted
in the hook so the next caller does not repeat it.

## 2026-08-26 — Harnesses must not inherit each other's state

Running `verify:screens` straight after `verify:ui` failed with "entry not
present in More at all" — which sounded like a missing screen. It was not:
`verify:ui` finishes with the filter sheet OPEN, and its backdrop swallowed
every tap the next script made.

`verify:screens` now relaunches the app first, like `verify:ui` already did, so
neither depends on what ran before. Both pass back-to-back in either order.

Recording it because the failure message pointed at the wrong thing twice over:
first at the app (a screen missing), then at flakiness (it had passed minutes
earlier). The actual cause was a modal left open by a different script.

## 2026-08-26 — Visits and Branches (Phase 10 complete)

**A DENIED entry attempt is shown alongside successes, not filtered out.** It
is the more interesting row — somebody stood at the door and did not get in —
and "27 visits today" that quietly excludes four refusals hides the thing a
manager needs to act on. The reason is shown next to it.

**"Turned away" keeps its tile even at zero.** A manager checking whether
anyone was refused needs the answer; an absent tile reads as "not measured"
rather than "none".

**Today's visits show a clock time; older ones show "3 days ago".** Nobody
cares that a visit was at 7:04am last Tuesday, but this morning's time is
exactly what the desk is checking.

**Branches is read-only and every line is conditional.** Most branch fields are
optional in the schema and are commonly null; a row rendering "null · null ·
null" is worse than one that just says the branch name. Creating branches is
also a desktop job — addresses and opening hours get set up once.

## 2026-08-26 — Harness: fail fast when signed out

The access token is short-lived and there is no refresh token
(TODO_FOR_ME item 4), so a long device run can be signed out from under it.
`verify:screens` was grinding through every retry on every entry waiting for
labels that could never appear — a ten-minute run ending in a pile of
misleading "screen not found" failures. It now detects the sign-in screen up
front and says so in two seconds.

It also retries a tap once. A single tap into a just-scrolled list
intermittently does not register, and *which* entry missed moved between runs —
the signature of a harness problem, not a broken screen.

## 2026-08-26 — Settings (Phase 11): seventeen web pages, one phone screen

The web app has seventeen settings pages. This is deliberately **not** a port
of them. On a phone the ones that matter are the gym's contact details — which
change when a gym moves or gets a new number — and a readable statement of what
plan it is on. Roles, permissions, integrations, payment gateways and tax
templates are long forms configured once from a desk; porting them would
produce screens nobody opens on a phone, and the screen says so rather than
leaving the absence unexplained.

**Subscription is READ-ONLY.** Changing a plan is a payment-gateway flow with
the Apple-IAP implications the plan flags in §10 R5. Showing the state without
offering to change it is honest and keeps that decision on the web.

**The API takes `studio_name`; the GET returns `name`.** Sending `name` is
silently accepted and changes nothing — `forbidNonWhitelisted` strips it — so
the screen would look like it saved and would not have. Mapped inside the
mutation rather than in the screen, so there is one place to be wrong.

**Only changed fields are sent**, reusing `changedFields` from the member
editor: a seven-field phone form must not blank the twenty-odd studio columns
it never showed.

**The form seeds when the sheet OPENS**, not on every render, so a background
refetch cannot overwrite what the owner is halfway through typing.

Verified on device: set the gym phone to 9810000123, saved, confirmed in the
API — phone written, name untouched.

## 2026-08-26 — Marketing = leads, not campaigns (Phase 9)

**Leads, deliberately not campaigns.** A campaign is authored at a desk —
audiences, copy, scheduling — while a LEAD is chased on a phone between other
jobs, which is what this device is for. Campaign management stays on the web,
and the plan's Phase 9 scope is narrowed accordingly rather than half-ported.

**The default view is "Open" (new + contacted).** A list that leads with the
ones already converted or lost is a report; this is a work queue.

**`converted` is NEVER settable from here.** The API has a dedicated
`POST /leads/:id/convert` that creates the member record. Flipping the status
alone would mark somebody joined with no membership behind them — the funnel
would look healthy and the gym would have gained nobody. So the row offers only
the NEXT step (new → contacted → trial booked) and stops.

**`lost` is neutral-toned, not red.** Most leads are lost — that is what a
funnel is — and painting the common case as an error makes the list read as a
wall of failures rather than a work queue.

**Status filters go to the SERVER**, except "Open", which is two statuses and
is narrowed client-side from an unfiltered fetch. A gym can have thousands of
leads, and downloading them all to hide most is the habit that makes a list
slow on the phones staff carry.

Verified on device and in the API: advanced Sneha Iyer new → contacted, and the
funnel recomputed.

## 2026-08-26 — RBAC tested against REAL permission sets (Phase 12)

Every RBAC test in this app used permission sets I invented. That proves the
gating *logic* is right and says nothing about whether my assumptions match
what the server grants — and those assumptions had already been wrong twice:

- a trainer cannot record a member's measurements (`members.edit`), and
- an accountant has no `staff.*` at all, so Staff and PT sessions are invisible
  to them, which I briefly mistook for a navigation bug.

`src/__tests__/fixtures/real-permissions.ts` now holds the actual
`permission_codes` returned by `POST /auth/login` for each of the four seeded
role accounts, and `rbac-real.test.ts` asserts the app's behaviour against
them: who reaches what, and what tab bar each role actually gets.

**If the server's role definitions change, these tests SHOULD fail** and be
re-captured deliberately. That failure is the signal — a role quietly gaining
`payments.view` is exactly the change worth being told about.

## 2026-08-26 — Touch targets raised to 44pt (Phase 12, accessibility)

`npm run audit:a11y` reads the live accessibility tree and reports interactive
elements smaller than Apple's 44pt minimum. On its first run it found eight on
one screen:

- **SegmentedControl segments: 32pt.** My own component, used on almost every
  screen.
- **`Button size="sm"`: 36pt.** The registry default — fine for a mouse, short
  for a finger.

Both are now 44pt on native; web keeps the tighter sizing, where a cursor is
doing the pointing. "Small" should mean visually lighter, not harder to hit —
this app is used standing up and one-handed on a gym floor, which is close to
the worst case for a small target.

The audit reports rather than fails, because some small elements are decorative
and correctly not interactive; it needs a human read. Re-run across Home,
Members, Money, Inventory and Leads: **zero** undersized targets.

Also checked and found clean: no icon-only control lacks a text label (the one
the crude scan flagged was a false positive — the button does have a `<Text>`),
and colour contrast is already handled by the token ladder mirrored from the
web app.

## 2026-08-26 — Trainers can record measurements (TODO item 7, decided)

**Decision taken by the owner:** a trainer should be able to record a member's
measurements. Of the three options I laid out, I implemented the third — a
narrower permission — rather than the simpler second.

**Why not just grant trainers `members.edit`.** That is one line and it would
have worked, but `edit` also grants renaming a member and changing their phone
and email. The ask was measurements; handing over the whole member record
because it was easier is how permission sets rot.

**So `members.measure` exists**, and trainers hold `members.view` +
`members.measure` and nothing else new. Verified against the running API: a
trainer can now POST a measurement (201) and still cannot rename a member
(403).

**The endpoint accepts `measure` OR `edit`, via a new `@AnyPermissions`.**
This is the part that took the most care. `measure` is a brand-new code, so no
existing role carries it — and roles on a live gym are resolved from seeded
`RolePermission` rows, which `DEFAULT_ROLE_PERMISSIONS` does not govern.
Swapping the endpoint from `edit` to `measure` outright would have silently
locked out every owner and manager in production. The OR means the new action
only ever widens. Confirmed: owner 201, front desk 201, accountant still 403.

`@AnyPermissions` is a separate metadata key, so every route that does not opt
in keeps the existing all-of behaviour — asserted directly in
`test/auth/any-permissions.spec.ts`, including the admin-bypass log line that
previously read only the all-of list.

**UPDATE and DELETE of a measurement stay on `edit`/`delete`.** There is no
`recorded_by` or `updated_at` on `member_body_stats`, so an amended reading is
untraceable. A mistyped 175kg is corrected by recording a new measurement,
which preserves the history — the same append-only shape this codebase already
uses for expenses.

**Two dead ends worth recording**, because each cost real time:
1. I first edited `DEFAULT_ROLE_PERMISSIONS` in `common/guards/`. That map is a
   fallback for the JWT guard; the codes in the login response come from
   `ENTERPRISE_ROLES` in `auth/rbac-seed.service.ts`. Editing the wrong map
   changed nothing and looked like the change had failed.
2. After rebuilding, the old backend process still held port 4002 and my new
   one lost the race — so I was testing stale code and briefly concluded the
   fix did not work.
