# FitSync — Member App

The member-facing mobile app for the FitSync Pro gym SaaS. React Native + Expo
client on top of the **Member BFF** (`/member/v1`) that lives inside the existing
NestJS backend. Built to the specs in `../docs/`:

- `PRD_Member_App.md` — product scope (Phase 1 = the core loop)
- `TRD_Member_App.md` — architecture (BFF, multi-tenant, offline-first)
- `Phase1_Build_Checklist.md` — endpoint + security checklist
- `Member api v1.openapi.yaml` — the API contract (single source of truth)
- `../design.md` — the Vercel/Geist design system, translated to a dark-first
  mobile theme in `tailwind.config.js` + `src/design-system/tokens.ts`

## What's in this scaffold (Phase 1)

The full Phase-1 surface, wired to the BFF contract:

| Area | Screen / module |
|---|---|
| Onboarding & auth | `welcome` → `phone` → `otp` → `choose-gym` (multi-gym) → `goal` |
| Home dashboard | `(app)/home` — greeting, membership, streak, today's workout, next class, live occupancy |
| QR check-in | `checkin` (modal) — camera scan → idempotent check-in, offline-queued |
| Workout | `(app)/workout` — assigned plan, set logging (steppers), rest timer, PR celebration |
| Progress | `(app)/progress` — weight stats, SVG trend chart, log weight, private photos |
| Membership | `membership` — plan, status, invoices, Razorpay renew (order create) |
| Profile | `(app)/profile` — fitness profile, settings, biometric toggle, DPDP export/delete, sign out |
| Notifications | `notifications` — push enable + empty feed |

Cross-cutting:
- **API client** (`src/api/`): typed endpoints, `{data,meta}` envelope unwrap,
  Bearer auth, automatic 401 → refresh → retry, contract types mirrored from the
  OpenAPI spec.
- **Auth** (`src/auth/`): Supabase phone OTP → exchange for member JWT; tokens in
  `expo-secure-store`; zustand stores for session + onboarding prefs.
- **Offline-first** (`src/offline/`): `expo-sqlite` outbox with client idempotency
  keys; check-in / metric / workout-log writes queue and reconcile on reconnect
  (server dedupes — no double counts).
- **Design system** (`src/design-system/`): `design.md` tokens → NativeWind theme,
  primitives (Txt, Button, Card, Input, Badge, Screen, Skeleton, Stepper, Icon),
  and the single brand mesh gradient used at hero scale only.

## Getting started

```bash
npm install            # or: npm install --legacy-peer-deps
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL + Supabase keys
npm run start          # then press a / i, or scan with Expo Go
npm run typecheck      # tsc --noEmit
```

> **Device testing:** set `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP
> (e.g. `http://192.168.1.20:4000/member/v1`), not `localhost`.

> **Staging only:** point Supabase at the staging project with fake tenants
> (see `project_member_bff_phase0` memory). Never test against production gyms.

## Architecture notes / boundaries

- The app holds **no business logic that enforces security** and **no DB
  credentials** (TRD §1). Tenant + member scoping is enforced server-side; the
  client renders server-authorised data only.
- The app talks **only** to `/member/v1` — never the admin API, never the DB.
- Payments are **never** self-reported: renew creates a Razorpay order; the BFF
  webhook is the source of truth. The app refreshes `/membership` afterward.

## Known gaps (match the BFF's deferred work)

These depend on backend pieces noted as deferred/blocked in the BFF:

- **Workouts**: no workout/exercise/PR tables exist server-side yet, so
  `/workouts/*` will 404 until those models ship. The screen is built to contract.
- **Razorpay checkout**: order creation is stubbed server-side; the client shows
  the created order but does not yet open the Razorpay checkout SDK
  (`react-native-razorpay` is the next dependency).
- **Progress photos**: signed-URL upload flow is implemented client-side and will
  work once `/progress/photos/upload-url` is backed by object storage.
- **Realtime occupancy**: uses polling (`useOccupancy`, 15s). Socket.IO tenant
  rooms (TRD §7) are a follow-up.
- **Push**: registers a device token via `expo-notifications`; FCM project config
  (google-services / APNs) must be added for real delivery.
- **Fonts**: Geist substitutes (Inter / JetBrains Mono) are referenced in the
  theme but not yet bundled via `expo-font`; falls back to system fonts.

## Regenerating the API client

The curated types in `src/api/types.ts` mirror the contract. To regenerate the
full machine types:

```bash
npm run gen:api   # openapi-typescript -> src/api/contract.ts
```
