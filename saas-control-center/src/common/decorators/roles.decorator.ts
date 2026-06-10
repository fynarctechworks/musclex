import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'allowed_roles';

/**
 * Restricts the decorated route to admins whose `role` is in the allowed list.
 *
 * Default (no decorator) keeps the pre-H1 behaviour: any authenticated admin
 * passes through. We opted for explicit allowlists rather than fail-closed so
 * this rolls out without a security regression on un-annotated paths.
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
