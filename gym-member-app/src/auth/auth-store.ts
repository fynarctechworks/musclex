import { create } from 'zustand';
import { api } from '../api/endpoints';
import { sessionBridge } from '../api/session-bridge';
import { queryClient } from '../lib/query-client';
import { closeChatSocket } from '../realtime/chat-socket';
import type { MemberProfile, MeContext, TenantChoice, TokenPair } from '../api/types';
import { clearSession, loadSession, saveSession } from './secure-store';
import { sendPhoneOtp, verifyPhoneOtp } from './supabase';
import { isDevOtpEnabled } from '../config';

type Status = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthState {
  status: Status;
  profile: MemberProfile | null;
  /**
   * The experience selector (/me/context): userType + capabilities, available
   * for EVERY app user incl. gym-less public users. Drives navigation + screen
   * gating. null while loading / offline.
   */
  context: MeContext | null;
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

/**
 * Load the post-login identity. /me/context works for everyone (public + gym);
 * the gym-only /me profile is fetched ONLY for non-public users so a public user
 * never triggers the gym-member 403.
 */
async function loadIdentity(): Promise<{
  context: MeContext | null;
  profile: MemberProfile | null;
}> {
  let context: MeContext | null = null;
  try {
    context = await api.meContext();
  } catch {
    context = null; // offline / transient — screens will retry
  }
  let profile: MemberProfile | null = null;
  if (!context || context.userType !== 'public') {
    profile = await api.me().catch(() => null);
  }
  return { context, profile };
}

// The verified Supabase token is held only in memory, only between OTP verify and
// the (possibly two-step, multi-gym) BFF session exchange. Never persisted.
let pendingSupabaseToken: string | null = null;

// ⚠️ DEV-ONLY: in the OTP-bypass flow there is no Supabase token, so the
// multi-gym "choose gym" step re-calls the dev route with the original
// phone+code. Held in memory only, same lifetime as pendingSupabaseToken.
let pendingDevCredentials: { phone: string; code: string } | null = null;

async function applyTokens(tokens: TokenPair, tenantId: string | null) {
  sessionBridge.setTokens(tokens);
  await saveSession({ tokens, tenantId });
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  profile: null,
  context: null,
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
    // Best-effort identity refresh; failure (e.g. offline) keeps the session.
    const { context, profile } = await loadIdentity();
    set({ context, profile });
  },

  requestOtp: async (phone: string) => {
    // ⚠️ DEV bypass: no SMS to send — the code is fixed. Skip Supabase entirely
    // so the screen advances to /otp where the dev code is entered.
    if (isDevOtpEnabled()) return;
    // BFF decides whether to dispatch (no enumeration); Supabase sends the SMS.
    await api.requestOtp(phone);
    await sendPhoneOtp(phone);
  },

  verifyOtp: async (phone: string, code: string) => {
    // ⚠️ DEV bypass: exchange phone + fixed code directly for a member session,
    // no Supabase round-trip. Otherwise verify the SMS OTP with Supabase first.
    const result = isDevOtpEnabled()
      ? await api.devSession(phone, code)
      : await (async () => {
          const supabaseToken = await verifyPhoneOtp(phone, code);
          pendingSupabaseToken = supabaseToken;
          return api.createSession(supabaseToken);
        })();

    if (result.tokens) {
      await applyTokens(result.tokens, null);
      pendingSupabaseToken = null;
      pendingDevCredentials = null;
      // Load identity BEFORE flipping status so AuthGate sees auth + userType +
      // onboarding together (no home→onboarding flash; public users skip setup).
      const { context, profile } = await loadIdentity();
      set({ status: 'authenticated', context, profile, pendingTenantChoices: null });
      return 'authenticated';
    }

    if (result.tenantChoices && result.tenantChoices.length > 0) {
      // Remember how to finish the session at the gym-choice step.
      if (isDevOtpEnabled()) pendingDevCredentials = { phone, code };
      set({ pendingTenantChoices: result.tenantChoices });
      return 'choose-gym';
    }

    throw new Error('No session and no gym choices returned.');
  },

  chooseGym: async (tenantId: string) => {
    // ⚠️ DEV bypass: re-call the dev route with the original phone+code.
    const result = pendingDevCredentials
      ? await api.devSession(
          pendingDevCredentials.phone,
          pendingDevCredentials.code,
          tenantId,
        )
      : await (async () => {
          if (!pendingSupabaseToken) {
            throw new Error('Session choice expired. Please sign in again.');
          }
          return api.createSession(pendingSupabaseToken, tenantId);
        })();
    if (!result.tokens) throw new Error('Could not start session for that gym.');
    await applyTokens(result.tokens, tenantId);
    pendingSupabaseToken = null;
    pendingDevCredentials = null;
    // Load identity before flipping status (see verifyOtp).
    const { context, profile } = await loadIdentity();
    set({ status: 'authenticated', tenantId, context, profile, pendingTenantChoices: null });
  },

  refreshProfile: async () => {
    const { context, profile } = await loadIdentity();
    // Keep prior values on a null (offline) result rather than blanking the UI.
    set((s) => ({
      context: context ?? s.context,
      profile: profile ?? s.profile,
    }));
  },

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    sessionBridge.setTokens(null);
    closeChatSocket();
    await clearSession();
    pendingSupabaseToken = null;
    // Drop all cached member data so it can't leak to the next account signing in
    // on the same device (multi-tenant safety).
    queryClient.clear();
    set({
      status: 'unauthenticated',
      profile: null,
      context: null,
      tenantId: null,
      pendingTenantChoices: null,
    });
  },
}));
