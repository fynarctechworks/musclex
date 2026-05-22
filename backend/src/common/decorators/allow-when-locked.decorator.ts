import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route handler as exempt from SubscriptionLockGuard.
 *
 * Use ONLY for billing/auth/subscription endpoints — every other mutation
 * must be blocked when the tenant is LOCKED or SUSPENDED.
 *
 * Examples:
 *  - POST /api/v1/subscription/renew      ← must work after lock
 *  - POST /api/v1/auth/logout             ← user must be able to leave
 *  - POST /api/v1/settings/subscription   ← plan change after grace
 */
export const ALLOW_WHEN_LOCKED_KEY = 'allow_when_locked';
export const AllowWhenLocked = () => SetMetadata(ALLOW_WHEN_LOCKED_KEY, true);
