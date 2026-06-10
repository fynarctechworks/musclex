# "Continue with Google" — Setup & How It Works

Social sign-in (Google now, Apple later) for the **gym admin web app** (`frontend/`).
The code is fully wired; the only remaining step is enabling the provider in the
Supabase dashboard — that part lives in config, not code.

## How it works (architecture)

We keep the repo's **"Option A"** auth model: the backend (NestJS) stays the
source of truth, even for OAuth.

```
[Login/Register page]
   └─ "Continue with Google"  →  supabase.auth.signInWithOAuth({ provider:'google' })
        └─ Google consent  →  redirect back to  /auth/callback  (with a Supabase session)
             └─ POST /auth/oauth/sync  { access_token, refresh_token }   (public endpoint)
                  └─ backend verifies the Supabase token (getUser), then runs the SAME
                     post-auth pipeline as password login:
                       • syncIdentity()         ← writes user_identities (REQUIRED — the JWT
                                                   guard rejects users without this row)
                       • seed role=owner + onboarding_step=studio_info for NEW users only
                       • reconcileOnboardingStep ← returning user → 'complete'
                       • device + login history + session + SCC touch
                       • RBAC / workspace resolution
                  └─ returns the normalized { user, studio, workspaces, tokens }
             └─ frontend routes exactly like password login:
                  fresh user      → /onboarding/studio-info   (completes the 7-step wizard)
                  returning user  → /{slug}/dashboard
                  multi-workspace → /workspace-select
```

**New vs existing user is automatic.** Supabase links a Google identity to an
existing account when the email matches and is verified, so a gym owner who
originally signed up with email/password and later clicks "Continue with Google"
resolves to the **same** user → same `studio_id` → straight to their dashboard.
A genuinely new Google user has no studio → drops into onboarding.

> **If linking is disabled** in your Supabase project, Google would mint a
> *separate* auth user for an email that already has a password account. The
> backend detects this collision (the local `user_identities.email` is unique)
> and returns a clean **409 — "An account with this email already exists. Please
> sign in with your email and password."** instead of crashing. Keep Supabase's
> default email-linking ON to get seamless one-click sign-in for returning users.

## What you must enable (Supabase dashboard — one-time)

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID*
   (type: **Web application**).
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret**.
2. **Supabase Dashboard** → Authentication → **Providers → Google** → enable, paste
   the Client ID + Secret, Save.
3. **Supabase Dashboard** → Authentication → **URL Configuration → Redirect URLs**,
   add every origin the app runs on, each with `/auth/callback`:
   - `http://localhost:3000/auth/callback`
   - `https://<your-prod-domain>/auth/callback`

Until step 2 is done, the button shows a clear toast ("Google sign-in isn't
enabled yet. Please use email and password.") — nothing else breaks.

## Apple

The **Apple button is now rendered** on both Login and Register
(`<SocialAuthButtons providers={['google','apple']} />`) and requests the
`name email` scope. The backend path is identical to Google — no backend changes
needed. To make it function you must complete the provider config:

1. **Apple Developer account** (paid, $99/yr) → create an **App ID**, a
   **Services ID**, and a **Sign in with Apple key** (.p8). Note Team ID + Key ID.
2. **Apple** → Services ID → Return URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. **Supabase Dashboard** → Authentication → Providers → **Apple** → enable, paste
   Services ID (client id), Team ID, Key ID, and the .p8 key, Save.

Until step 3 is done, the Apple button shows the same graceful toast
("Apple sign-in isn't enabled yet. Please use email and password.").

## Files

| File | Change |
|---|---|
| `frontend/src/components/auth/social-auth-buttons.tsx` | New — Google/Apple buttons + divider |
| `frontend/src/app/login/page.tsx` | Added social row |
| `frontend/src/app/register/page.tsx` | Added social row |
| `frontend/src/app/auth/callback/page.tsx` | Now syncs via backend + shared routing |
| `frontend/src/hooks/use-auth.ts` | Extracted shared routing; added `loginWithOAuth` |
| `frontend/src/features/auth/api.ts` | Added `oauthSync` |
| `backend/src/auth/auth.controller.ts` | New public `POST /auth/oauth/sync` |
| `backend/src/auth/auth.service.ts` | Extracted `buildAuthenticatedResponse`; added `oauthSync` |
| `backend/src/auth/dto/oauth-sync.dto.ts` | New DTO |
