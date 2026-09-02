# Sign in with Apple — gym admin web (`app.musclex.infynarc.com`)

Reference for the "Continue with Apple" button on the gym admin login/register
pages. The app code was already written; this covers the Apple + Supabase
configuration around it, and the one recurring maintenance task it creates.

## The values

> **⚠️ Migrated to Mumbai (2026-09-01).** The Supabase project ref changed from
> `tcpchduxxqsjnsybegjz` (Singapore) to `czblwakdilgrdphusdhz` (Mumbai), so the
> **Return URL below is new**. Sign in with Apple will NOT work until this exact
> URL is registered in the Apple Developer console (Certificates, Identifiers &
> Profiles → your Services ID → Website URLs → Return URLs), and the Apple
> provider is re-enabled in the new project's Supabase dashboard
> (Authentication → Providers → Apple) with the same Services ID, Team ID, Key ID
> and .p8 key. The same applies to Google if it is enabled.


| What | Value |
|---|---|
| Team ID | `64FS75NJV9` |
| Key ID | `8F7D8FM5SM` |
| Private key | `~/Documents/AuthKey_8F7D8FM5SM.p8` (**outside the repo — never commit**) |
| Services ID (`client_id`) | `com.infynarc.musclex.service` |
| Primary App ID | `com.infynarc.musclex.staff` (`AR96L46NVV`) |
| Supabase project | `czblwakdilgrdphusdhz` |
| Return URL | `https://czblwakdilgrdphusdhz.supabase.co/auth/v1/callback` |
| App domain | `app.musclex.infynarc.com` |

The `.p8` is downloadable exactly once and is unrecoverable. If it is lost,
revoke the key in the Developer Portal and issue a new one — there is no
"download again".

## Apple's four-step checklist

1. **Enable App ID** — `APPLE_ID_AUTH` on `com.infynarc.musclex.staff`.
   Done via the App Store Connect API:
   ```sh
   asc bundle-ids capabilities add --bundle AR96L46NVV --capability APPLE_ID_AUTH \
     --settings '[{"key":"APPLE_ID_AUTH_APP_CONSENT","options":[{"key":"PRIMARY_APP_CONSENT","enabled":true}]}]'
   ```
   Without this the App ID does not appear in the "Configure Key" dropdown.
2. **Create Services ID for Web Authentication** — Developer Portal UI only.
   Apple's `BundleIdPlatform` enum is `IOS | MAC_OS | UNIVERSAL`; there is no
   `SERVICES` value on write, so no API can create one. Its Configure panel
   holds the domain and Return URL above.
3. **Create Key** — Developer Portal UI only. No API exposes Sign in with Apple
   key creation, by design.
4. **Register Email Sources** — optional for login; needed only to email users
   who chose "Hide My Email" through Apple's Private Email Relay.

Only step 1 is automatable. Steps 2–4 are Apple-side UI limitations, not
tooling gaps.

## The client secret expires — this is the part that bites

Supabase's Apple provider does not take the `.p8`. It takes an **ES256 JWT
signed with it**, and Apple caps that JWT at 6 months. When it expires, every
Apple sign-in fails at once with an opaque `invalid_client` from Apple — there
is no warning and no partial degradation.

Regenerate and re-paste it into Supabase before the printed expiry:

```sh
node scripts/apple-client-secret.js
```

Defaults resolve to the values above, so a bare re-run is the normal case.
`--json` prints a machine-readable form. The key is read from disk and never
echoed. Overrides: `--team-id`, `--key-id`, `--client-id`, `--key-path`.

Paste the output into **Supabase → Authentication → Providers → Apple →
Secret Key**, alongside `com.infynarc.musclex.service` as the Client ID.

## Also required in Supabase

- **Authentication → URL Configuration → Redirect URLs** must include
  `https://app.musclex.infynarc.com/auth/callback`, which is where
  `SocialAuthButtons` sends the browser back to. Supabase silently refuses
  redirects that are not on this list.

## How the app code handles it

- `frontend/src/components/auth/social-auth-buttons.tsx` — starts the handshake.
  It pre-flights `/auth/v1/settings` so a disabled provider shows a toast rather
  than dead-ending the user on a raw Supabase 400 page.
- `frontend/src/app/auth/callback/page.tsx` — exchanges the code (PKCE) or hash
  tokens (implicit) for a session, then calls the backend.
- `backend/src/auth/auth.service.ts` → `oauthSync` — verifies the token
  server-side, then provisions the local identity **by email**. It already
  rejects an Apple private-relay opt-out with an actionable message, since an
  account cannot be created without one.

Two Apple behaviours worth knowing when debugging:

- Apple returns the user's **name only on the very first authorization**. A
  failed first sync loses it permanently; the account survives, the name does
  not.
- "Hide My Email" yields a `@privaterelay.appleid.com` address. That is a real,
  deliverable address, but only while the relay is configured (step 4).
