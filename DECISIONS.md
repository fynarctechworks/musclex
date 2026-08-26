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

## 2026-08-26 — Login now returns a refresh token (TODO item 4, fixed)

**The cause was not Supabase.** `refresh_token` sat in
`StripSecretsInterceptor`'s global `ALWAYS_STRIP` list, so it was removed from
every response — including the login response whose entire job is to hand back
a session. Supabase was returning it the whole time; the interceptor was
deleting it on the way out.

That is why the mobile client could never refresh silently and had to sign the
user out on every 401. It cost me real time repeatedly during device testing:
long runs kept dying mid-way, and one such sign-out was what made me briefly
suspect a session-persistence bug that did not exist.

**The fix is deliberately narrow.** Stripping `refresh_token` is right almost
everywhere — a member or staff row that happens to carry one must never go out.
So the exemption is a short allowlist of endpoints whose response IS a
credential, handed to the person who just proved they own it:

`/auth/login`, `/auth/refresh`, `/auth/2fa/login`, `/auth/2fa/verify`,
`/auth/select-workspace`, `/auth/oauth/sync`.

Matched on the path SUFFIX, and only for `refresh_token` — every other secret
is still stripped on those routes, which is asserted directly. `login-history`
is in the tests specifically because it contains the word "login" and must NOT
match.

Verified end to end: login returns a refresh token, `POST /auth/refresh`
exchanges it for a new session, and `/members` still contains no occurrence of
the field.

## 2026-08-26 — 2FA verified end to end against the API (TODO item 3, partly closed)

Previously listed as unverified. Verified with real TOTP codes (the repo
already has `speakeasy`), against the running backend, using the accountant
account:

| Step | Result |
|---|---|
| Plain login | 201, `requires_2fa: false` |
| `POST /auth/2fa/setup` | 201 — QR, manual key and otpauth URL |
| `POST /auth/2fa/verify` with a real code | 201 — **8 backup codes** |
| Login again | 201, `requires_2fa: true`, `temp_token` issued |
| — and **no `access_token` in that response** | **confirmed absent** |
| `POST /auth/2fa/login` step 2 | 201, access **and** refresh token |
| Step 2 with a wrong code | **401** |

The line that matters most is the middle one: a challenged login must not hand
back a usable session, or the second factor is decoration. It does not.

**The account was restored to password-only afterwards.** My first attempt to
disable it failed — `/auth/2fa/disable` takes the **password**, not a TOTP
code, and I sent a code (400). The retry then failed too because
`two_factor_secret` is AES-encrypted at rest, so a code minted from the raw
column is meaningless (401) — which is correct and reassuring. The fixture was
restored with a guarded single-row update.

**Still unverified: the app's 2FA SCREEN.** The API contract is proven; what I
have not driven is `app/(auth)/two-factor.tsx` on the device, because doing so
means leaving a seeded account in a 2FA state while the simulator is driven
through it. Worth one manual pass — noted in TODO_FOR_ME.

**Multi-workspace remains unverified**: it needs one user holding roles in two
studios, which the seeder does not create.

## 2026-08-26 — Multi-workspace: built the fixture, found it broken, fixed it

Asked to add multi-workspace and test it. Adding the fixture immediately showed
the feature did not work — in **three** separate places, none of which had ever
been exercised because no seeded account had two studios.

**Fixture.** `scripts/seed-second-gym.ts` provisions "MuscleX Bandra" the way
the product does (clone `studio_template`), and grants the existing owner a
role in it. Gym 1 has 40 members, gym 2 has 12 — deliberately different, so a
switch that silently keeps showing the previous gym is visible at a glance
rather than being invisible.

**Bug 1 — the switch did not switch.** `selectWorkspace` validated access and
returned the new studio's name, but never persisted the choice.
`JwtAuthGuard` resolves the active studio from Supabase
`user_metadata.studio_id`, so every request afterwards carried on serving the
previous gym. Measured: selected "MuscleX Bandra" (12 members), got 201 and the
right name back, and `GET /members` still returned 40.

**Bug 2 — persisting was not enough.** The access token EMBEDS `user_metadata`
at mint time, so a token issued before the switch keeps pointing at the old gym
regardless. `/auth/select-workspace` now optionally takes the caller's refresh
token and returns a session already scoped to the chosen studio, so one call
does the whole job. A failed refresh is not fatal — the switch is already
persisted, and the caller can recover by refreshing.

**Bug 3 — the app threw its own tokens away.** On `requires_workspace_selection`
the client returned only the workspace list and discarded the interim
`access_token` that came with it. `/auth/select-workspace` is authenticated, so
the next call went out with no token and came back 401 — which the picker
displayed as **"Session expired"**. The tokens were in the response all along.

They are now carried to the picker in memory and used for exactly one call —
deliberately NOT written to the session store, because storing them would make
the app briefly signed in to whichever gym the account defaults to, and
`AuthGate` would send the user straight past the picker.

**A design consequence worth knowing:** the active studio is a property of the
ACCOUNT, not of a session. A user signed in on web and phone who switches on
one will switch on the other. That is how this system already works for
onboarding; changing it means moving the studio into the token, which is a
larger change than this fix.

Verified on device: picker lists both gyms, selecting Bandra lands on a
dashboard headed "MuscleX Bandra" showing **12** active members rather than 40.

## 2026-08-26 — Sentry, wired to send no member data

Approved by the owner. `@sentry/react-native` installed via `npx expo install`.

**The default configuration would have been a leak.** Sentry is built for
consumer apps: it attaches request URLs, bodies and user identifiers unless
told not to. In a multi-tenant gym SaaS each of those carries members' names,
phone numbers, measurements and payment amounts. So every one is turned off or
scrubbed explicitly rather than trusted to a default:

- `sendDefaultPii: false` — no IP address, no automatic identifiers.
- **Query strings are stripped from every breadcrumb.** `GET
  /members?search=Neha` would otherwise ship a member's name to a third party
  on every keystroke of a desk search. This is the one I would most expect a
  team to miss.
- UUIDs in paths are masked to `:id`. The route SHAPE is what makes an issue
  groupable; the id only makes it identifiable.
- Request and response bodies are dropped entirely; console breadcrumbs are
  dropped (a developer can log anything).
- User context carries the **staff row id, role and gym id** — no email, no
  name. Enough to answer "which gym, which role, how many people affected", not
  enough to identify a person. Gym id is a TAG rather than part of `user`, so
  issues group by tenant without a tenant being treated as a person.
- Context is cleared on sign-out, so a later crash is not filed against
  whoever last used the phone.

**Off unless `EXPO_PUBLIC_SENTRY_DSN` is set**, and the key is committed to
`.env` empty. Crash reporting should be switched on deliberately, never left on
by accident.

`tracesSampleRate: 0.1` — a gym floor is not a place to spend somebody's mobile
data on telemetry.

The scrubbers are unit-tested directly, because they are the part that must not
be wrong.

---

## Staff push notifications: tokens live in `public`, keyed by the person

`MemberDeviceToken` is per-studio (`@@schema("studio_template")`, registered in
TENANT_MODELS). The obvious move was to copy it for staff. I did not, and the
reason is the requirement you gave me: **cleared on sign out.**

A member belongs to one gym. A staff member does not — the same phone can hold
roles in several studios, and after the multi-workspace work it genuinely does.
If tokens were per-studio, "clear my device on sign out" would be a walk over
every studio the person belongs to, and **any studio missed keeps pushing that
gym's alerts to a handset whose owner has signed out**. That is the exact
failure the requirement exists to prevent, so the storage should make it
impossible rather than merely unlikely.

So: `public.staff_device_tokens`, keyed by `user_id`. Sign-out is one
`deleteMany`. Verified against the running API — a device registered in two
gyms, one unregister call, `{"removed": 2}`.

**It carries a `gym_id` and is deliberately NOT in TENANT_MODELS.** That column
is the send TARGET, not a tenant scope, and the Prisma gym_id injection never
sees the public client anyway. Because that is exactly the shape of a
cross-tenant leak, three things guard it:

1. `StaffPushService.sendToStaff(gymId, ...)` takes the gym as a **required
   argument** and always puts it in the WHERE clause — never inferred from
   ambient context.
2. The drift guard (`tenant-models.spec.ts`) had to be told about it, so I made
   the exemption *enforced* rather than commented: a new test reads
   `schema.prisma` and fails if anything on the exemption list is not actually
   declared `@@schema("public")`. Confirmed it fails when a tenant model is
   added to the list.
3. `test/push/staff-push.service.spec.ts` asserts the gym filter on every read.

### Other decisions in the same slice

- **`unregister` clears the token in every gym, but only for the calling
  user.** Scoped by `user_id` as well as the token, so one person cannot
  unregister another's handset by guessing a token string. Verified: the owner
  attempting to unregister the front desk's device got `{"removed": 0}`.
- **`register` takes the handset away from any previous owner** (`deleteMany
  where token = t AND user_id != me`). Sign-out clears tokens over the network,
  so a sign-out on a dead connection leaves rows behind. A shared front-desk
  phone must never keep notifying the last person who held it; the next sign-in
  repairs it.
- **Sign-out never blocks on the network.** `unregisterForPush()` runs before
  the session is cleared (the endpoint is authenticated — clearing first makes
  it a 401 that silently leaves the device registered), but a failure is logged
  and sign-out proceeds. The reclaim rule above is what makes that safe.
- **Registration can never break sign-in.** Denied permission, a simulator with
  no push support, a missing EAS projectId and an offline network all resolve
  to "no token", never to an error a user sees.
- **Dead tokens are pruned on send.** Expo returns HTTP 200 and reports dead
  handsets *inside* the ticket body; `DeviceNotRegistered` rows are deleted, so
  an uninstalled app is not retried forever. Transient errors are kept.
- **Deep links from a push payload are untrusted.** Only in-app paths are
  followed (`/…`, and not `//…`), so a payload cannot push an external URL into
  the router.
- One `expo-transport.ts` now serves both the member and staff paths, so the
  details that decide whether a notification lands — the `ExponentPushToken[`
  filter, Expo's 100-per-request chunking, reading tickets back — cannot drift.

### expo-notifications is loaded defensively, and here is what that is worth

A bare `import * as Notifications from 'expo-notifications'` throws at MODULE
LOAD time when the native module is missing — before any try/catch inside a
function can help. Because the import chain reaches the root layout, that throw
is not a degraded push feature: it is a full-screen red error instead of an app.
On the dev build that predates the dependency I measured 63 such errors and a
red screen.

A guarded `require` brings it to 2. Not 0 — the remaining pair are thrown
*asynchronously* from inside expo-notifications' own initialisation, which a
synchronous catch cannot reach. So the guard contains the failure to push code
paths and lets `getNotifications()` return null cleanly, but it does **not**
make a stale dev build usable. The rebuild does; after `expo run:ios` the app
launches with 0 errors and the permission prompt appears with our own copy.

I am recording the number because the tempting version of this comment — "the
module is optional, so a missing native module degrades gracefully" — would
have been the kind of claim that agrees with itself and is wrong on a real
device.

### Sign-out cannot be blocked by push, at two levels

`unregisterForPush()` swallows its own network errors, and `signOut()` wraps
the call in its own try/catch anyway. The second one is not redundant: the
first test I wrote for this passed while asserting the OPPOSITE of its name —
"still signs out when unregistering fails" was asserting that sign-out
*rejected*. It did. Nothing about push may ever leave someone unable to sign
out of a shared phone, so the guarantee is now enforced at the call site too.

**Not done, deliberately: nothing sends a staff push yet.** The pipe is built
and verified; `sendToStaff` is injectable anywhere. Which events should reach a
staff phone (an overdue payment? a class starting unstaffed? a failed
check-in?) is a product decision, and CLAUDE.md says not to guess at business
logic.

---

## AI advisor: "coming soon", and never naming our config to a customer

You asked for the advisor to read as coming soon in both apps until the LLM key
lands. Three decisions inside that:

**Only CHAT is model-backed.** The Insights tab and the Daily Briefing are
rules over the gym's own numbers — churn risk, expiring memberships, pending
payments — and they work today. A blanket "coming soon" over the AI page would
have hidden working analytics, so the gate is on the chat surface only.

**The fallback text was the real bug.** Without a key the advisor replied *"To
get real-time AI insights, ensure your ANTHROPIC_API_KEY environment variable
is configured."* — to a **gym owner**. That names our internal configuration to
a paying customer, on a screen where they cannot act on it, and frames an
unreleased feature as a broken one. It is now one honest sentence plus a
pointer to the page that already has the answer.

**No composer when it is unavailable.** The drawer and the chat tab render the
coming-soon panel *instead of* the input, not above it. A box that accepts a
question and answers "not yet" wastes the person's time; saying so before they
type reads as a roadmap. `GET /api/v1/ai/status` is what the UI asks, and it is
outside the entitlement check — otherwise the "coming soon" state would itself
depend on a plan lookup.

---

## `/admin/referrals/*` was a platform-admin screen wearing a gym-owner
## decorator

Written up in TODO_FOR_ME.md item 4 with the measured example. The decision
worth recording here is **why I fixed it without asking**, given the open
product question next to it.

The product question is "what should a gym owner see of their own referral
funnel". That is genuinely yours. But it was sitting on top of an
authorisation defect that is not a product question at all: a gym owner could
read every other gym's referral counts, names and codes, and could **write** —
create and edit reward campaigns, force referral statuses, revoke other gyms'
rewards, clear fraud signals. CLAUDE.md's standing exception covers exactly
this (endpoint-level permission checks in `backend/`), and leaving a live leak
open while a product decision is pending is the wrong trade.

The fix is not new machinery: `assertPlatformAdmin` already existed on the
class, documented as "platform-only actions (rule config, cross-tenant
reporting)", and had been applied to four handlers out of twenty. This is the
recurring shape in this codebase — **things that agree with themselves while
being wrong**. The helper, its docstring and the four call sites were all
consistent; nothing pointed at the sixteen handlers that never called it.

`GET rules` stays owner-readable on purpose: reward rules are the offer we
publish to gyms, and the gym-facing settings page renders them.

---

## The mobile app could be challenged by 2FA but could never turn it on

You went looking for Settings → Security on the phone and it was not there.
It was not hidden or role-gated: `staff-app` had **no Security screen at all**.
`app/(auth)/two-factor.tsx` — the login step-2 screen — has existed since 2FA
shipped, so the app could *demand* a code from a staff member while giving them
no way to enrol. Enrolment lived only on the web.

Built `app/more/security.tsx` against the endpoints that already existed
(`/auth/2fa/{status,setup,verify,disable}`); no backend change.

Decisions inside it:

- **The row is not permission-gated.** Every other entry in More checks a
  module permission; this one passes `module: null`. It is the signed-in
  person's own account setting, not gym configuration. Gating it on
  `settings.view` would mean the roles most likely to be sharing a handset —
  front desk, trainers — are exactly the ones who cannot secure it.
- **Only your own account.** `/auth/2fa/admin-reset/:userId` exists and is
  owner-only; resetting a colleague's 2FA is a support conversation after they
  lose a phone, not a two-tap flow on whichever iPad is at the desk.
- **"I've saved them" is disabled until the backup codes are saved or
  explicitly acknowledged.** They are shown once and the server keeps only
  hashes. The natural build — a Done button live from the first render — makes
  losing them the default.
- **No new dependency for copying.** `expo-clipboard` is a native module and
  would force another dev-build rebuild. React Native's built-in `Share` sheet
  offers Copy alongside Notes, Files and a password manager, which is where
  backup codes actually belong, and the codes are `selectable` so long-press →
  Copy works without leaving the screen.
- **Disable takes the PASSWORD, not a code** — which is the server's rule, and
  the screen says why: whoever is holding an unlocked phone already has the
  authenticator on it, so accepting a code would let a thief switch off the
  control protecting the account.

### It found a real bug, which is the point of driving it on a device

An account with BOTH 2FA and more than one gym hit **"Session expired"** on the
workspace picker. The 2FA screen navigated to the picker without forwarding the
interim access token, so `/auth/select-workspace` — which is authenticated —
went out with no credentials. The user typed a correct password AND a correct
2FA code and was told their session had expired.

The password path was fixed for exactly this weeks ago. `two-factor.tsx` was
missed, and nothing caught it: they are separate screens, and only an account
with both 2FA and two gyms ever reaches the second one. A test now asserts both
screens forward `result.interim`, because the failure mode is divergence
between two files that each look correct alone.

---

## The schema-split generator could not run on this machine

`backend/scripts/_phase2_split.js` hardcoded `e:/Projects/musclex/backend/prisma`
— an absolute path from another developer's machine. So the script that
generates `schema.public.prisma` and `schema.tenant.prisma` had been unrunnable
here for the whole project, and both files were hand-edited for months under a
header reading "do not hand-edit yet".

That is worse than untidy: the two files back two SEPARATE Prisma clients, and
when they drift the symptom is not a build error — it is a client missing a
model or a column at runtime, in whichever half nobody updated.

Rewritten to resolve `prisma/` from `__dirname`, plus:

- **`--check` mode** that exits non-zero naming the drifted files, wired to
  `npm run schema:check` and to a Jest test so CI catches it.
- The comparison is **whitespace-insensitive**. The committed files are
  `prisma format`-ed and the generator is not, so a byte comparison would
  report drift on every run and teach everyone to ignore the check — which is
  how the files came to be hand-edited in the first place.
- **Preconditions are checked, not assumed.** The original comment said
  "verified: 0 cross-schema relations, 0 enums" — true when written, and a
  schema that has since grown either would be split into two files that
  generate but do not work. Both now refuse the split with the offending names.
- **Doc comments are carried over.** The original dropped them, which would
  have silently deleted the paragraph explaining why `StaffDeviceToken` is
  deliberately outside TENANT_MODELS.

Regenerating produced **zero semantic difference** from the hand-edited files —
they had been kept faithfully by hand, which is luck, not a system. Confirmed
the guard bites by adding a field to `schema.prisma` and watching the test fail.
