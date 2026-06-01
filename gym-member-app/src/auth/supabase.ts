import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config, isSupabaseConfigured } from '../config';

/**
 * Supabase client used ONLY for phone-OTP delivery/verification (the existing
 * SaaS IdP). We never use the Supabase session for API calls — the BFF mints its
 * own member token. The Supabase session is short-lived plumbing to obtain the
 * `supabaseToken` we exchange at POST /auth/session.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Send a phone OTP via Supabase (no enumeration — BFF gates whether to send). */
export async function sendPhoneOtp(phone: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({ phone });
  if (error) throw error;
}

/** Verify the OTP code and return the Supabase access token to exchange at the BFF. */
export async function verifyPhoneOtp(
  phone: string,
  token: string,
): Promise<string> {
  const { data, error } = await getSupabase().auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('OTP verification returned no session.');
  return accessToken;
}
