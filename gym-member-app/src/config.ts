import Constants from 'expo-constants';

/**
 * Runtime config. Prefer EXPO_PUBLIC_* env vars (baked at build); fall back to
 * app.json `extra` for local dev. The API base URL must include /member/v1.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const config = {
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    extra.apiBaseUrl ??
    'http://localhost:4000/member/v1',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '',

  // Analytics/monitoring (PostHog). Empty key → analytics is a no-op (dev console).
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',

  // SCC Error Center ingest. When both are set, caught JS errors are reported to
  // the SaaS Control Center's error monitoring (POST /system-errors, x-ingest-key
  // auth). Independent of PostHog. URL should be the SCC API base (no path) — e.g.
  // https://scc-api.musclex.app — the reporter appends /system-errors.
  sccIngestUrl: process.env.EXPO_PUBLIC_SCC_INGEST_URL ?? '',
  sccIngestKey: process.env.EXPO_PUBLIC_SCC_INGEST_KEY ?? '',

  // ⚠️ DEV-ONLY OTP bypass. The login screens skip Supabase SMS; the OTP screen
  // GENERATES a code and shows it on-screen for the tester to type. Active in dev
  // builds (__DEV__) — production builds use the real SMS OTP flow. Set
  // EXPO_PUBLIC_MEMBER_DEV_OTP to pin a FIXED code instead of a generated one
  // (the BFF then requires that exact code). The BFF also refuses the bypass
  // against a production backend, so a stray value here is inert there.
  devOtp: process.env.EXPO_PUBLIC_MEMBER_DEV_OTP ?? '',

  // ⚠️ DEV-ONLY. When '1', re-show the onboarding intro on every app launch so
  // the intro screens can be QA'd repeatedly (set EXPO_PUBLIC_FORCE_INTRO=1 in
  // .env). Has no effect unless explicitly set — leave unset for normal builds.
  forceIntro: process.env.EXPO_PUBLIC_FORCE_INTRO === '1',
};

export const isSupabaseConfigured = () =>
  !!config.supabaseUrl && !!config.supabaseAnonKey;

export const isAnalyticsConfigured = () => !!config.posthogKey;

export const isSccErrorReportingConfigured = () =>
  !!config.sccIngestUrl && !!config.sccIngestKey;

/**
 * Dev OTP bypass is active in dev builds, or whenever a fixed code is pinned via
 * EXPO_PUBLIC_MEMBER_DEV_OTP. Production builds (__DEV__ === false, no env) use
 * the real SMS OTP flow.
 */
export const isDevOtpEnabled = () => __DEV__ || !!config.devOtp;

/**
 * Dev-only OTP code shown to the tester. Uses the pinned code when
 * EXPO_PUBLIC_MEMBER_DEV_OTP is set, otherwise generates a fresh 6-digit code.
 * The BFF dev bypass accepts any well-formed code in non-prod, so the generated
 * value works as-is.
 */
export const generateDevOtp = (): string =>
  config.devOtp || String(Math.floor(100000 + Math.random() * 900000));
