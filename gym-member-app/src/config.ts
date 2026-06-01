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
};

export const isSupabaseConfigured = () =>
  !!config.supabaseUrl && !!config.supabaseAnonKey;
