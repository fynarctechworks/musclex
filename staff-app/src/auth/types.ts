/**
 * Session shapes, mirroring frontend/src/stores/auth-store.ts so the two
 * clients agree on what a session IS. Divergence here is how a staff member
 * ends up with different permissions on web and mobile.
 */

/** module -> allowed actions, e.g. { members: ['view','create'] }. */
export type PermissionsMap = Record<string, string[]>;

export type StaffUser = {
  id: string;
  email: string;
  full_name: string;
  /** owner | manager | front_desk | trainer | accountant | ... */
  role: string;
  studio_id?: string;
  organization_id?: string;
  branch_ids: string[];
  /** Map form. The API currently sends permission_codes instead. */
  permissions?: PermissionsMap;
  /** Flat "module.action" codes — the shape the API actually returns. */
  permission_codes?: string[];
  onboarding_step?: string;
};

export type Studio = {
  id: string;
  name: string;
  slug: string;
  timezone?: string;
  /** ISO 4217. Drives every money formatter — never assume INR. */
  currency?: string;
  logo_url?: string | null;
  subscription_plan?: string;
};

export type Session = {
  user: StaffUser;
  studio: Studio | null;
  accessToken: string;
  /**
   * Optional: the login response omits it when Supabase returns no session
   * object (observed with admin-created accounts). Without it the client
   * cannot silently refresh and must sign out on 401 instead.
   */
  refreshToken?: string;
  /** null = "All branches". Sent as X-Active-Branch-Id when set. */
  activeBranchId: string | null;
};

/** Shape returned by POST /auth/login and /auth/select-workspace. */
export type AuthResponse = {
  access_token: string;
  refresh_token?: string;
  user: StaffUser;
  studio?: Studio | null;
  /** Present when the account has 2FA enabled and must complete it. */
  requires_2fa?: boolean;
  /** Step-2 token for 2FA. Sent back as `tempToken` to /auth/2fa/login. */
  temp_token?: string;
  /** Present when the user belongs to more than one workspace. */
  requires_workspace_selection?: boolean;
  /** Shape per backend auth.service.ts — studio_id/studio_name, not id/name. */
  workspaces?: Workspace[];
};

export type Workspace = {
  studio_id: string;
  studio_name: string;
  roles: string[];
};
