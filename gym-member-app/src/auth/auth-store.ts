import { create } from 'zustand';
import { api } from '../api/endpoints';
import { sessionBridge } from '../api/session-bridge';
import type { MemberProfile, TenantChoice, TokenPair } from '../api/types';
import { clearSession, loadSession, saveSession } from './secure-store';
import { sendPhoneOtp, verifyPhoneOtp } from './supabase';

type Status = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthState {
  status: Status;
  profile: MemberProfile | null;
  tenantId: string | null;

  /** Multi-gym disambiguation between OTP verify and final session. */
  pendingTenantChoices: TenantChoice[] | null;

  hydrate: () => Promise<void>;
  requestOtp: (phone: string) => Promise<void>;
  /** Returns 'authenticated' | 'choose-gym' so the UI can route. */
  verifyOtp: (phone: string, code: string) => Promise<'authenticated' | 'choose-gym'>;
  chooseGym: (tenantId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (p: MemberProfile) => void;
  signOut: () => Promise<void>;
}

// The verified Supabase token is held only in memory, only between OTP verify and
// the (possibly two-step, multi-gym) BFF session exchange. Never persisted.
let pendingSupabaseToken: string | null = null;

async function applyTokens(tokens: TokenPair, tenantId: string | null) {
  sessionBridge.setTokens(tokens);
  await saveSession({ tokens, tenantId });
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  profile: null,
  tenantId: null,
  pendingTenantChoices: null,

  hydrate: async () => {
    sessionBridge.setOnExpired(() => {
      void get().signOut();
    });
    const stored = await loadSession();
    if (!stored) {
      set({ status: 'unauthenticated' });
      return;
    }
    sessionBridge.setTokens(stored.tokens);
    set({ tenantId: stored.tenantId, status: 'authenticated' });
    // Best-effort profile refresh; failure (e.g. offline) keeps the session.
    try {
      const profile = await api.me();
      set({ profile });
    } catch {
      /* offline — home will retry */
    }
  },

  requestOtp: async (phone: string) => {
    // BFF decides whether to dispatch (no enumeration); Supabase sends the SMS.
    await api.requestOtp(phone);
    await sendPhoneOtp(phone);
  },

  verifyOtp: async (phone: string, code: string) => {
    const supabaseToken = await verifyPhoneOtp(phone, code);
    pendingSupabaseToken = supabaseToken;
    const result = await api.createSession(supabaseToken);

    if (result.tokens) {
      await applyTokens(result.tokens, null);
      pendingSupabaseToken = null;
      set({ status: 'authenticated', pendingTenantChoices: null });
      await get().refreshProfile();
      return 'authenticated';
    }

    if (result.tenantChoices && result.tenantChoices.length > 0) {
      set({ pendingTenantChoices: result.tenantChoices });
      return 'choose-gym';
    }

    throw new Error('No session and no gym choices returned.');
  },

  chooseGym: async (tenantId: string) => {
    if (!pendingSupabaseToken) {
      throw new Error('Session choice expired. Please sign in again.');
    }
    const result = await api.createSession(pendingSupabaseToken, tenantId);
    if (!result.tokens) throw new Error('Could not start session for that gym.');
    await applyTokens(result.tokens, tenantId);
    pendingSupabaseToken = null;
    set({ status: 'authenticated', tenantId, pendingTenantChoices: null });
    await get().refreshProfile();
  },

  refreshProfile: async () => {
    try {
      const profile = await api.me();
      set({ profile });
    } catch {
      /* keep prior profile */
    }
  },

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    sessionBridge.setTokens(null);
    await clearSession();
    pendingSupabaseToken = null;
    set({
      status: 'unauthenticated',
      profile: null,
      tenantId: null,
      pendingTenantChoices: null,
    });
  },
}));
