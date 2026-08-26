import { getSession } from '@/auth/session-store';
import { api } from '@/api/client';
import type { AuthResponse, Session, Workspace } from '@/auth/types';

/**
 * Auth calls.
 *
 * Paths carry no extra prefix: the backend controllers declare
 * `@Controller('api/v1/auth')` and there is no global prefix, so with
 * API_BASE_URL ending in /api/v1 these resolve correctly.
 *
 * Login is a THREE-step flow, not one:
 *   1. /auth/login            -> full session, OR requires_2fa, OR requires_workspace_selection
 *   2. /auth/2fa/login        -> full session (when 2FA is on)
 *   3. /auth/select-workspace -> full session (when the user has >1 studio)
 * Any of steps 2 and 3 may be skipped. Screens must handle all paths.
 */

export type LoginResult =
  | { kind: 'session'; session: Session }
  | { kind: '2fa'; tempToken: string }
  | {
      kind: 'workspace';
      workspaces: Workspace[];
      /**
       * The interim session issued ALONGSIDE the workspace challenge.
       *
       * `/auth/select-workspace` is an authenticated route, so without this the
       * next call goes out with no token and comes back 401 — which the app
       * showed as "Session expired" on the gym picker. The tokens were in the
       * login response the whole time and were simply being dropped here.
       *
       * Deliberately NOT written to the session store: doing so would make the
       * app briefly "signed in" to whichever gym the account defaults to, and
       * AuthGate would send the user straight past the picker. It is carried in
       * memory and used for exactly one call.
       */
      interim?: { accessToken: string; refreshToken?: string };
    };

/** Build a Session from an auth payload, or null if it isn't a complete one. */
export function toSession(res: AuthResponse): Session | null {
  if (!res.access_token || !res.user) return null;
  return {
    user: res.user,
    studio: res.studio ?? null,
    accessToken: res.access_token,
    refreshToken: res.refresh_token,   // may be undefined — see Session.refreshToken
    activeBranchId: null,
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password }, { anonymous: true });

  if (res.requires_2fa && res.temp_token) return { kind: '2fa', tempToken: res.temp_token };
  if (res.requires_workspace_selection) {
    return {
      kind: 'workspace',
      workspaces: res.workspaces ?? [],
      interim: res.access_token
        ? { accessToken: res.access_token, refreshToken: res.refresh_token }
        : undefined,
    };
  }

  const session = toSession(res);
  if (!session) throw new Error('Login response was missing a session');
  return { kind: 'session', session };
}

/** Step 2 cannot itself return another 2FA challenge, so that variant is excluded. */
export type TwoFactorResult = Exclude<LoginResult, { kind: '2fa' }>;

/** Step 2. NOTE: the DTO field is `tempToken` (camelCase), unlike the rest. */
export async function verifyTwoFactor(tempToken: string, code: string): Promise<TwoFactorResult> {
  const res = await api.post<AuthResponse>('/auth/2fa/login', { tempToken, code }, { anonymous: true });
  if (res.requires_workspace_selection) {
    return {
      kind: 'workspace',
      workspaces: res.workspaces ?? [],
      interim: res.access_token
        ? { accessToken: res.access_token, refreshToken: res.refresh_token }
        : undefined,
    };
  }
  const session = toSession(res);
  if (!session) throw new Error('2FA response was missing a session');
  return { kind: 'session', session };
}

/** Step 3. Requires the bearer token from step 1/2, so it is NOT anonymous. */
/**
 * Switch to another gym this account belongs to.
 *
 * The CURRENT refresh token is sent along, because the active studio is
 * embedded in the access token when it is minted — a token issued before the
 * switch keeps serving the previous gym no matter what this call returns.
 * Passing it lets the server hand back a session already scoped to the chosen
 * studio, so the switch takes effect on the very next request.
 *
 * Without it the endpoint returns a studio name and changes nothing, which is
 * exactly how this path looked functional while doing nothing at all.
 */
export async function selectWorkspace(
  studioId: string,
  branchId?: string,
  /** Interim credentials from the login that raised the workspace challenge. */
  interim?: { accessToken: string; refreshToken?: string },
): Promise<Session> {
  const current = getSession();
  const refreshToken = interim?.refreshToken ?? current?.refreshToken;

  const res = await api.post<AuthResponse>(
    '/auth/select-workspace',
    {
      studio_id: studioId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    },
    // At the picker there is no stored session yet, so the interim token is
    // supplied explicitly rather than read from the store.
    interim
      ? { anonymous: true, headers: { Authorization: `Bearer ${interim.accessToken}` } }
      : undefined,
  );
  const session = toSession(res);
  if (!session) throw new Error('Workspace selection returned no session');
  return session;
}

export function forgotPassword(email: string) {
  return api.post<{ message?: string }>('/auth/forgot-password', { email }, { anonymous: true });
}

export type Branch = { id: string; name: string; is_active?: boolean };

export function listBranches() {
  return api.get<Branch[] | { data: Branch[] }>('/branches');
}

// ── Two-factor enrolment ────────────────────────────────────────────────────
//
// Login step-2 lives above (`verifyTwoFactor`). These are the ENROLMENT calls,
// and unlike step-2 they all require a live session — you can only turn 2FA on
// for yourself, while signed in as yourself.

export interface TwoFactorStatus {
  enabled: boolean;
  method: string | null;
}

export interface TwoFactorSetup {
  /** data:image/png;base64,… — renderable directly by <Image source={{ uri }} />. */
  qr_code: string;
  /** Typed by hand when a camera cannot see the screen it is showing. */
  manual_key: string;
  otpauth_url: string;
}

export interface TwoFactorEnabled {
  enabled: boolean;
  /** Shown ONCE. The server does not store them in a readable form. */
  backup_codes: string[];
}

export function twoFactorStatus(): Promise<TwoFactorStatus> {
  return api.get<TwoFactorStatus>('/auth/2fa/status');
}

export function twoFactorSetup(): Promise<TwoFactorSetup> {
  return api.post<TwoFactorSetup>('/auth/2fa/setup');
}

export function twoFactorVerifySetup(code: string): Promise<TwoFactorEnabled> {
  return api.post<TwoFactorEnabled>('/auth/2fa/verify', { code });
}

/**
 * Turn 2FA off. Takes the account PASSWORD, not a code.
 *
 * That is deliberate on the server's side and worth stating here, because the
 * obvious assumption is the opposite: a stolen unlocked phone already has the
 * authenticator on it, so a code would let a thief disable the very control
 * that was protecting the account.
 */
export function twoFactorDisable(password: string): Promise<{ disabled: boolean }> {
  return api.post<{ disabled: boolean }>('/auth/2fa/disable', { password });
}
