import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = 'isPublicRoute';

/**
 * Marks a route as unauthenticated, exempting it from `JwtAuthGuard`.
 *
 * WHY this exists: `JwtAuthGuard` is applied at the class level on several
 * controllers. A bare `@UseGuards()` on a handler does NOT clear guards
 * inherited from the controller — Nest merges them — so webhook routes that
 * were annotated `@UseGuards() // no JWT required` were still being rejected
 * with 401 before their signature-verification code could run.
 *
 * Use ONLY for endpoints that authenticate the caller by another means —
 * e.g. gateway webhooks that verify an HMAC signature over the raw body.
 * Never put this on a route that reads or writes tenant data without its own
 * equivalent proof of origin.
 */
export const PublicRoute = () => SetMetadata(IS_PUBLIC_ROUTE, true);
