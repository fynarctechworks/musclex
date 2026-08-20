import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase is used for ONE thing: proving the member owns their phone number.
 * It sends the OTP and verifies it; the resulting Supabase token is then traded
 * with our own backend for a gym-scoped member session. No app data is ever
 * read through this client.
 *
 * Returns null when the project is not configured, which is how the app falls
 * back to the dev bypass on machines with no SMS provider.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Supabase persists its own session; keep it off plain storage on device. */
const secureStorage = {
  getItem: (k: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null)
      : SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(void globalThis.localStorage?.setItem(k, v))
      : SecureStore.setItemAsync(k, v),
  removeItem: (k: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(void globalThis.localStorage?.removeItem(k))
      : SecureStore.deleteItemAsync(k),
};

let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  client =
    url && anonKey
      ? createClient(url, anonKey, {
          auth: {
            storage: secureStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
          },
        })
      : null;
  return client;
}

/** True when real phone OTP is available; false means the dev bypass is in play. */
export const otpConfigured = () => supabase() !== null;
