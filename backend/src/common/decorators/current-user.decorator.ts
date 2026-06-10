import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export type PermissionModule =
  | 'dashboard'
  | 'members'
  | 'check_ins'
  | 'payments'
  | 'classes'
  | 'staff'
  | 'marketing'
  | 'ai'
  | 'settings'
  | 'branches'
  | 'organizations'
  | 'reports'
  | 'roles'
  | 'inventory'
  | 'analytics'
  | 'integrations';

export type PermissionsMap = Partial<Record<PermissionModule, ModuleAction[]>>;

export interface UserRoleSummary {
  role_name: string;
  branch_id: string | null;
  is_primary: boolean;
}

export type SubscriptionLifecycleStatus =
  | 'active'
  | 'grace_period'
  | 'locked'
  | 'suspended';

export interface SubscriptionContext {
  status: SubscriptionLifecycleStatus;
  plan: string;
  billing_cycle: string;
  expires_at: string | null;        // next_billing_date (ISO)
  grace_until: string | null;       // when LOCKED triggers (ISO)
  locked_at: string | null;
  days_until_expiry: number | null; // null if no billing date
  grace_days_remaining: number | null; // null unless grace_period
  can_mutate: boolean;              // false when locked/suspended
}

export interface JwtPayload {
  user_id: string;
  studio_id: string;
  organization_id?: string; // tenant-schema Organization record ID
  role: string; // primary role name (backward compat)
  roles: UserRoleSummary[]; // all roles in current studio context
  branch_ids: string[]; // branches user has access to (empty = all)
  branch_id?: string; // current active branch (if workspace selected)
  email: string;
  permissions: PermissionsMap; // legacy format (backward compat)
  permission_codes: string[]; // flat list: ["members.create", "payments.view"]
  subscription?: SubscriptionContext; // populated by JwtAuthGuard
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
