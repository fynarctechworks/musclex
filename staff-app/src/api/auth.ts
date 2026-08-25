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
  | { kind: 'workspace'; workspaces: Workspace[] };

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
  if (res.requires_workspace_selection) return { kind: 'workspace', workspaces: res.workspaces ?? [] };

  const session = toSession(res);
  if (!session) throw new Error('Login response was missing a session');
  return { kind: 'session', session };
}

/** Step 2 cannot itself return another 2FA challenge, so that variant is excluded. */
export type TwoFactorResult = Exclude<LoginResult, { kind: '2fa' }>;

/** Step 2. NOTE: the DTO field is `tempToken` (camelCase), unlike the rest. */
export async function verifyTwoFactor(tempToken: string, code: string): Promise<TwoFactorResult> {
  const res = await api.post<AuthResponse>('/auth/2fa/login', { tempToken, code }, { anonymous: true });
  if (res.requires_workspace_selection) return { kind: 'workspace', workspaces: res.workspaces ?? [] };
  const session = toSession(res);
  if (!session) throw new Error('2FA response was missing a session');
  return { kind: 'session', session };
}

/** Step 3. Requires the bearer token from step 1/2, so it is NOT anonymous. */
export async function selectWorkspace(studioId: string, branchId?: string): Promise<Session> {
  const res = await api.post<AuthResponse>('/auth/select-workspace', {
    studio_id: studioId,
    ...(branchId ? { branch_id: branchId } : {}),
  });
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
