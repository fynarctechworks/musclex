# Security Rules

## Input Validation
- All DTOs must use class-validator decorators — never trust raw input
- Validate types, lengths, formats, and enums at the controller level
- Sanitize strings to prevent XSS (strip HTML/script tags)
- Validate file uploads: check MIME type, size limit, extension whitelist

## Authentication & Authorization
- All endpoints require `Authorization: Bearer {jwt}` except `/auth/*`
- Use JwtAuthGuard on every controller (no exceptions)
- RBAC enforced via role decorators — check role + permissions before action
- Max 5 failed logins -> 15min lockout (Redis TTL)
- JWT payload: user_id, studio_id, role, branch_ids[]

## Tenant Isolation
- **Every query must be scoped by studio_id** — TenantMiddleware sets `search_path = studio_{studio_id}`
- Never allow cross-tenant data access
- gym_id/studio_id required on all create/read/update/delete operations
- Validate that the requesting user belongs to the target studio

## Sensitive Data
- `face_descriptor`: write-only, never returned in any API response
- `payment_method_token`: never returned in API responses
- `salary`: stripped from staff responses unless requester role === "owner"
- Passwords: bcrypt hashed, never logged or returned

## Storage & Files
- All Supabase Storage buckets: private
- Serve files via signed URLs only (1-hour expiry)
- Validate upload size and type server-side before storing

## Webhooks
- Verify HMAC signature on all incoming webhooks before processing
- Log webhook events for audit trail

## Rate Limiting
- Apply rate limiting on auth endpoints (login, register, password reset)
- Consider rate limiting on heavy endpoints (reports, exports)
