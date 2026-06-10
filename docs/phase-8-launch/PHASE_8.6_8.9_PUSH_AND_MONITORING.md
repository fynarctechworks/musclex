# Phase 8.6 + 8.9 — Push Notifications & Production Monitoring

**Date:** 2026-06-07 • **Method:** source inspection of push send/registration paths, automation engine, and monitoring wiring.

---

## 8.6 — Push notifications

### ✅ Working
- **Member push SEND is implemented** — [member-notification.service.ts:95](../../backend/src/member/data/member-notification.service.ts) POSTs batches to `https://exp.host/--/api/v2/push/send`, filtered by per-category opt-out prefs, restricted to `ExponentPushToken[...]`, with non-OK + exception handling. ✅
- **Device-token registration is robust** — [gym-member-app/src/features/notifications/push.ts](../../gym-member-app/src/features/notifications/push.ts): permission request → Expo token (preferred) → native fallback → registers BOTH an app-user token (public + gym users) and a gym-scoped token, with prefs; best-effort `.catch()` so failures never break the UI. `syncPushPrefs` + `disablePush` (on sign-out) present. ✅
- Campaign **delivery open/click tracking** exists (`appCampaignDelivery.updateMany`). ✅

### 🔴 Gaps / required before push is "verified end-to-end"
1. **External creds (your action):** Expo token needs `expoConfig.extra.eas.projectId`; the Expo Push API needs **FCM (Android) + APNs (iOS) credentials uploaded to EAS**. Without these, the client falls back to native device tokens that the Expo send path filters out → **0 sends**. This is the gating item for 8.6 and is an external/EAS step.
2. **Expo push receipts not processed** — the send path ignores Expo tickets/receipts, so `DeviceNotRegistered` dead tokens are never pruned. Low severity; recommend a follow-up receipt-poll to keep the token table clean.
3. **Marketing queue `sendPush` is still a stub** — [notification.processor.ts:92](../../backend/src/queue/processors/notification.processor.ts) logs "delivery TBD". SMS (Twilio) + WhatsApp in that processor ARE implemented; only its push branch is a stub. The member-facing push uses the Expo path above, so this stub affects the **gym-admin marketing** push channel only. Decide whether marketing push routes through the Expo service or stays out of scope for UAT.
4. **CORRECTION (2026-06-07): automation executor + cooldown ARE implemented — in the SCC, not the backend.** An earlier draft of this report said the executor was missing; that was wrong (it searched only `backend/src`). The real engine is [saas-control-center/.../member-app-campaigns.service.ts](../../saas-control-center/src/modules/member-app-analytics/member-app-campaigns.service.ts):
   - `@Cron(EVERY_HOUR) runDueAutomations()` + `ScheduleModule.forRoot()` registered → fires hourly. ✅
   - **Per-user cooldown dedup** via `app_campaign_deliveries` (`WHERE automation_key=… AND created_at > now() - cooldown_days·interval`). ✅
   - Resolves `target_segment` → `app_users` → `app_user_device_tokens` and **sends via Expo** (`exp.host/--/api/v2/push/send`). ✅
   - Manual `runAutomation(key)` also respects cooldown.
   - **Verified in live DB — 7 seeded automations present** with cooldowns: `welcome` (once/9999d), `water_reminder` + `workout_reminder` (1d), `incomplete_onboarding` (3d), `renewal_reminder` (7d), `nearby_gym_promo` + `winback` (14d). All `enabled=false` by default (admin enables per gym in SCC).

**8.6 verdict (revised):** both transactional push AND triggered automations + cooldown are **code-complete and verified**; the ONLY thing gating end-to-end push is the external EAS/FCM/APNs creds. Automations are off-by-default — enable the desired ones in SCC for UAT. *(Separately: the backend `AutomationWorkflow` CRUD — gym-admin SMS/WhatsApp marketing on `membership_expiring`/`member_inactive` — has no executor I could find; that is a distinct, gym-side marketing system, not the member-app automations above. Flagged, not built — building it would be new feature work, out of Phase-8 scope.)*

---

## 8.9 — Production monitoring

### ✅ Present
- **Backend:** Sentry global filter (active when `SENTRY_DSN` set), `nestjs-pino` structured logging, `GET /health`, env-validation-at-boot. Sentry test endpoint gated behind `ENABLE_SENTRY_DEBUG`.
- **Member app:** [src/monitoring/index.ts](../../gym-member-app/src/monitoring/index.ts) — PostHog HTTP capture for product events **+ JS errors + unhandled promise rejections** via the global `ErrorUtils` handler; fire-and-forget (never blocks user flow); env-gated on `EXPO_PUBLIC_POSTHOG_KEY`.

### Gaps / recommendations
1. **Native crash reporting missing** — JS-engine/native crashes need `@sentry/react-native` + an EAS build (already flagged as a follow-up in code). For UAT, JS-error capture covers the majority; **recommend** adding the native SDK before public beta.
2. **No uptime/API monitor or alerting** mentioned — recommend a simple external uptime check on `/health` + Sentry alert rules for the UAT window so tester-hit errors page someone.
3. Ensure `SENTRY_DSN` and `EXPO_PUBLIC_POSTHOG_KEY` are actually set in the UAT environment (otherwise both degrade to no-op/log-only).

**8.9 verdict:** adequate error capture for UAT once DSNs/keys are set; native crash reporting + uptime alerting are the gaps to close before public beta.

---

## Action items for you (external/decisions)
- [ ] Upload **FCM + APNs** creds to EAS and set **`eas.projectId`** (unblocks 8.6).
- [ ] Set `SENTRY_DSN` (backend) + `EXPO_PUBLIC_POSTHOG_KEY` (member app) in the UAT env.
- [ ] Decide: build the **automation trigger engine + cooldown**, or descope triggered automations from UAT.
- [ ] Decide: route marketing push through the Expo service, or descope the queue `sendPush` stub.
