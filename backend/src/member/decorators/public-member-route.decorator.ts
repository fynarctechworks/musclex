import { SetMetadata } from '@nestjs/common';

/**
 * Marks a /member/* route as not requiring a member access token.
 * Used only by the auth endpoints (/auth/otp/request, /auth/session,
 * /auth/refresh) which run BEFORE a member session exists.
 */
export const PUBLIC_MEMBER_ROUTE_KEY = 'isPublicMemberRoute';
export const PublicMemberRoute = () => SetMetadata(PUBLIC_MEMBER_ROUTE_KEY, true);
