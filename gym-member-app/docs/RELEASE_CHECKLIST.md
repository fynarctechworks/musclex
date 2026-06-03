# FitSync Member App — Release Checklist

> Living checklist for shipping the member app. Sections are added as gates are
> crossed. Created 2026-06-03 alongside the G3 dry-run (`G3_CROSS_PLAN.md`).

## Pre-flight (every release)
- [ ] `npm run typecheck` clean
- [ ] On-device smoke test (member app cannot run in Expo Go — needs a dev client)
- [ ] App version bumped (`app.config.ts` / `app.json` `version`)

## G3 — Native build (EAS dev client)
- [x] `expo-build-properties` installed; `app.config.ts` in place (`app.json` removed) — see `G3_CROSS_PLAN.md`
- [x] `targetSdkVersion` set to **35** (Play-valid; brief's 34 would be rejected)
- [x] kingstinct HealthKit plugin prop names verified against installed v9.0.11; `expo config` resolves (exit 0)
- [ ] `eas build:configure` run; `projectId` committed _(user runs — needs EAS login)_
- [ ] Android dev build installed on a **real Android 14 device with Health Connect**
- [ ] iOS dev build installed on a **real iPhone** (HealthKit doesn't work on Simulator)
- [ ] Wearable read path verified: steps / active kcal / distance / HR / resting HR / SpO₂ / sleep land in `member_health_daily` with sane units and dedupe on re-sync
- [ ] Re-verified post-build: push tokens, deep links, secure-store persistence, biometric unlock, camera QR (see `G3_CROSS_PLAN.md` §8)

### SHA-256 signing fingerprint capture (needed later for Samsung Partner Program — G4)
Capture the signing certificate SHA-256 after the first EAS build and record it
here (do **not** commit it to a secrets file):

```bash
# EAS-managed keystore:
eas credentials   # → Android → <profile> → view SHA-256 fingerprint

# from a local keystore:
keytool -list -v -keystore <path>.jks -alias <alias> | grep "SHA256:"

# from a built APK:
keytool -printcert -jarfile <build>.apk | grep "SHA256:"
```

- [ ] Debug build SHA-256: `__________________________________`
- [ ] Release build SHA-256: `__________________________________`
- [ ] Package name on record: `pro.fitsync.member`

> Not required for G3 itself — only for the future Samsung Partner submission (G4).

## G4 — Samsung Partner Program (future)
- [ ] Partner application submitted (package name + SHA-256 + data types + privacy policy URL + consent screenshots)
- [ ] Approval received before shipping any Samsung-exclusive metric paths
