# FitSync Pro — Frontend Integration Contract

> **Generated from actual backend codebase** | Backend: NestJS 10 + Prisma 5 + Supabase  
> **Frontend target:** Next.js 14 (App Router) + TypeScript + @tanstack/react-query  
> **Base URL:** `http://localhost:4000` (dev) — all routes prefixed with `/api/v1/`

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Tenant Context System](#2-tenant-context-system)
3. [RBAC Permission Map](#3-rbac-permission-map)
4. [Standard Request/Response Patterns](#4-standard-requestresponse-patterns)
5. [Full API Endpoint Registry](#5-full-api-endpoint-registry)
6. [Webhook Event Registry](#6-webhook-event-registry)
7. [Realtime Event System](#7-realtime-event-system)
8. [File Upload Endpoints](#8-file-upload-endpoints)
9. [Frontend Integration Summary](#9-frontend-integration-summary)

---

## 1. Authentication Flow

### Auth Provider

Supabase Auth (JWT). The backend validates tokens via `supabase.auth.getUser(token)`, then resolves RBAC permissions from normalized tables (with fallback to `DEFAULT_ROLE_PERMISSIONS`).

### Required Headers

```
Authorization: Bearer {supabase_jwt_token}
Content-Type: application/json
X-Branch-Id: {uuid}           // Optional — sets active branch context
```

### Registration Flow

```
POST /api/v1/auth/register        → Create account
POST /api/v1/auth/verify-email    → Verify OTP
GET  /api/v1/auth/plans           → List available studio plans
POST /api/v1/auth/select-plan     → Choose plan
POST /api/v1/auth/setup-studio    → Create studio + tenant schema
```

#### `POST /api/v1/auth/register`

**Request:**
```json
{
  "full_name": "John Doe",
  "email": "john@gym.com",
  "password": "securePass123",
  "phone": "+919876543210"
}
```

**Response (201):**
```json
{
  "user_id": "uuid",
  "email": "john@gym.com",
  "message": "Verification email sent"
}
```

#### `POST /api/v1/auth/verify-email`

**Request:**
```json
{
  "email": "john@gym.com",
  "otp": "123456"
}
```

#### `POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "john@gym.com",
  "password": "securePass123",
  "device_info": {
    "device_name": "Chrome on Windows",
    "device_type": "browser",
    "os": "Windows 11",
    "browser": "Chrome 120",
    "ip_address": "auto"
  }
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJS...",
  "refresh_token": "v1.refresh...",
  "user": {
    "user_id": "uuid",
    "email": "john@gym.com",
    "role": "owner",
    "studio_id": "uuid",
    "studio_name": "FitZone Gym",
    "branch_ids": ["uuid"],
    "workspaces": [
      {
        "studio_id": "uuid",
        "studio_name": "FitZone Gym",
        "role": "owner"
      }
    ]
  }
}
```

#### `POST /api/v1/auth/refresh`

**Request:**
```json
{
  "refresh_token": "v1.refresh..."
}
```

#### `POST /api/v1/auth/select-workspace`

**Request:**
```json
{
  "studio_id": "uuid"
}
```

### Rate Limits (Auth Endpoints)

| Endpoint | Limit |
|----------|-------|
| `POST /auth/register` | 5 requests / minute |
| `POST /auth/login` | 5 requests / minute |
| `POST /auth/resend-verification` | 3 requests / minute |
| `POST /auth/forgot-password` | 3 requests / minute |
| All other endpoints | 10/s (short) + 100/min (medium) global |

### Token Storage (Frontend)

```typescript
// Store in memory (Zustand) + httpOnly cookie for refresh
// Access token: short-lived, kept in Zustand store
// Refresh token: stored securely, used to get new access token
```

---

## 2. Tenant Context System

### How It Works

1. **JwtAuthGuard** extracts `studio_id` from JWT metadata
2. **TenantMiddleware** runs after auth — sets PostgreSQL `search_path` to `studio_{studio_id}`
3. All subsequent Prisma queries run against the tenant's schema automatically
4. If `studio_id` is missing or schema doesn't exist → `ForbiddenException (403)`

### Frontend Requirements

- Store `studio_id` after login (from auth response)
- Always send valid JWT — tenant context is derived from the token
- For multi-branch access, send `X-Branch-Id` header to scope branch-level queries
- If user has multiple workspaces, use `POST /auth/select-workspace` to switch

### Schema Name Format

```
studio_{studio_id_with_underscores}
// e.g., studio_id "a1b2c3d4-e5f6-..." → schema "studio_a1b2c3d4_e5f6_..."
```

---

## 3. RBAC Permission Map

### Roles Hierarchy

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | Platform | Full platform access |
| `owner` | Studio | Studio owner — full access |
| `brand_owner` | Organization | Multi-studio brand owner — full access |
| `regional_manager` | Region | Manages branches in a region |
| `branch_manager` / `manager` | Branch | Branch-level management |
| `trainer` | Branch | Class instruction + member view |
| `front_desk` | Branch | Check-ins + member registration |
| `accountant` | Studio | Financial data access |
| `marketing_manager` | Studio | Marketing + campaigns |

### Admin Bypass

Roles `super_admin`, `owner`, and `brand_owner` **bypass all permission checks** in `PermissionsGuard`.

### Permission Modules & Actions

Actions: `view` | `create` | `edit` | `delete` | `export`

| Module | super_admin/owner/brand_owner | regional_manager | branch_manager/manager | trainer | front_desk | accountant | marketing_manager |
|--------|------|------|------|------|------|------|------|
| `dashboard` | view, export | view, export | view, export | view | view | view, export | view |
| `members` | all + export | view, create, edit, export | view, create, edit, export | view | view, create, edit | view | view, export |
| `check_ins` | all + export | view, create, edit, export | view, create, edit, export | view, create | view, create | — | — |
| `payments` | all + export | view, create, edit, export | view, create, edit, export | — | view, create | all + export | — |
| `classes` | all + export | view, create, edit, delete, export | view, create, edit, delete | view, edit | view | — | — |
| `staff` | all + export | view, create, edit | view, create, edit | view | view | — | — |
| `marketing` | all + export | view, create, edit | view, create, edit | — | — | — | all + export |
| `ai` | view, create | view, create | view, create | view, create | — | — | view, create |
| `settings` | view, edit | view | view | — | — | — | — |
| `branches` | all | view, edit | view | view | view | view | view |
| `reports` | view, export | view, export | view, export | view | view | view, export | view |
| `roles` | all | view | view | — | — | — | — |
| `inventory` | all | — | — | — | — | — | — |
| `analytics` | all | all | all | — | — | — | — |
| `organizations` | all | — | — | — | — | — | — |
| `integrations` | all | — | — | — | — | — | — |

### Frontend Permission Check Pattern

```typescript
// JwtPayload from auth response
interface JwtPayload {
  user_id: string;
  studio_id: string;
  role: string;
  roles: { role_name: string; branch_id: string | null; is_primary: boolean }[];
  branch_ids: string[];
  branch_id?: string;
  email: string;
  permissions: Record<string, string[]>;
  permission_codes: string[];   // e.g. ["members.create", "payments.view"]
}

// Check permission
function hasPermission(user: JwtPayload, module: string, action: string): boolean {
  const adminRoles = ['super_admin', 'owner', 'brand_owner'];
  if (adminRoles.includes(user.role)) return true;
  return user.permission_codes.includes(`${module}.${action}`);
}
```

---

## 4. Standard Request/Response Patterns

### Pagination

**Request pattern** (query params):
```
GET /api/v1/members?page=1&limit=50&search=john&status=active
```

**Response format:**
```json
{
  "data": [...],
  "total": 247,
  "page": 1,
  "limit": 50
}
```

- Default `page`: 1
- Default `limit`: 50
- Max `limit`: 100 (on analytics DTOs)
- `total` = count of all matching records (for pagination UI)

### Error Format

NestJS built-in exception handling. All errors follow this format:

```json
{
  "statusCode": 404,
  "message": "Member not found",
  "error": "Not Found"
}
```

**Validation errors (400):**
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

| Status Code | Exception | When |
|-------------|-----------|------|
| 400 | `BadRequestException` | Invalid input, business logic violation |
| 401 | `UnauthorizedException` | Missing/expired token |
| 403 | `ForbiddenException` | Insufficient permissions, invalid tenant |
| 404 | `NotFoundException` | Resource not found |
| 409 | `ConflictException` | Duplicate entry, state conflict |
| 429 | `ThrottlerException` | Rate limit exceeded |

### Global Validation

All request bodies are validated with:
- `whitelist: true` — strips extra properties
- `forbidNonWhitelisted: true` — rejects unknown properties (400)
- `transform: true` — auto-transforms types

### Request Body Size Limit

1 MB maximum.

---

## 5. Full API Endpoint Registry

### 5.1 Auth (`/api/v1/auth/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | None | Register new account |
| POST | `/auth/verify-email` | None | Verify email OTP |
| POST | `/auth/resend-verification` | None | Resend verification email |
| GET | `/auth/plans` | None | Get available studio plans |
| POST | `/auth/select-plan` | JWT | Select a plan |
| POST | `/auth/setup-studio` | JWT | Create studio + tenant |
| POST | `/auth/login` | None | Login |
| POST | `/auth/logout` | JWT | Logout |
| POST | `/auth/refresh` | None | Refresh token |
| POST | `/auth/forgot-password` | None | Request password reset |
| POST | `/auth/reset-password` | None | Reset password with token |
| GET | `/auth/onboarding` | JWT | Get onboarding status |
| POST | `/auth/select-workspace` | JWT | Switch workspace/studio |

### 5.2 Auth Sessions (`/api/v1/auth/sessions/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/sessions` | JWT | List active sessions |
| DELETE | `/auth/sessions/:id` | JWT | Revoke specific session |
| POST | `/auth/sessions/revoke-all` | JWT | Revoke all sessions |
| GET | `/auth/sessions/devices` | JWT | List devices |
| DELETE | `/auth/sessions/devices/:id` | JWT | Revoke device |
| GET | `/auth/sessions/security` | JWT | Get security overview |
| GET | `/auth/sessions/login-history` | JWT | Login history |
| GET | `/auth/sessions/identity` | JWT | Identity info |
| POST | `/auth/sessions/identity/unlink/:provider` | JWT | Unlink provider |

### 5.3 Auth Admin (`/api/v1/auth/admin/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/auth/admin/login-history/:userId` | JWT | owner | User login history |
| POST | `/auth/admin/suspend/:userId` | JWT | owner | Suspend user |
| POST | `/auth/admin/reactivate/:userId` | JWT | owner | Reactivate user |
| POST | `/auth/admin/revoke-sessions/:userId` | JWT | owner | Revoke user sessions |

### 5.4 Auth SSO (`/api/v1/auth/sso/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/auth/sso/providers` | JWT | owner | List SSO providers |
| GET | `/auth/sso/providers/active` | JWT | — | List active providers |
| GET | `/auth/sso/providers/:id` | JWT | owner | Get SSO provider |
| POST | `/auth/sso/providers` | JWT | owner | Create SSO provider |
| PATCH | `/auth/sso/providers/:id` | JWT | owner | Update SSO provider |
| DELETE | `/auth/sso/providers/:id` | JWT | owner | Delete SSO provider |

### 5.5 Auth API Keys (`/api/v1/auth/api-keys/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/auth/api-keys` | JWT | owner | List API keys |
| GET | `/auth/api-keys/:id` | JWT | owner | Get API key |
| POST | `/auth/api-keys` | JWT | owner | Create API key |
| PATCH | `/auth/api-keys/:id` | JWT | owner | Update API key |
| PATCH | `/auth/api-keys/:id/activate` | JWT | owner | Activate key |
| PATCH | `/auth/api-keys/:id/deactivate` | JWT | owner | Deactivate key |
| DELETE | `/auth/api-keys/:id` | JWT | owner | Delete API key |

### 5.6 Members (`/api/v1/members/`)

| Method | Path | Permission | Query Params | Description |
|--------|------|------------|--------------|-------------|
| GET | `/members` | members:view | `branch_id`, `status`, `membership_type`, `search`, `page`, `limit` | List members |
| POST | `/members` | members:create | — | Create member |
| GET | `/members/:id` | members:view | — | Get member |
| PATCH | `/members/:id` | members:edit | — | Update member |
| DELETE | `/members/:id` | members:delete | — | Delete member |
| POST | `/members/:id/freeze` | members:edit | — | Freeze membership |
| POST | `/members/:id/unfreeze` | members:edit | — | Unfreeze membership |
| POST | `/members/:id/renew` | members:edit | — | Renew membership |
| POST | `/members/:id/face-descriptor` | members:edit | — | Upload face data (write-only) |
| GET | `/members/:id/profile` | members:view | — | Get full profile |
| GET | `/members/:id/body-stats` | members:view | — | Get body stats |
| POST | `/members/:id/body-stats` | members:create | — | Add body stats |
| GET | `/members/:id/progress` | members:view | — | Get progress timeline |
| GET | `/members/:id/visits` | members:view | `start_date`, `end_date` | Get visit history |
| GET | `/members/:id/notes` | members:view | — | Get member notes |
| POST | `/members/:id/notes` | members:create | — | Add note |
| GET | `/members/tags` | members:view | — | Get all tags |
| POST | `/members/tags` | members:create | — | Create tag |
| DELETE | `/members/tags/:tagId` | members:delete | — | Delete tag |
| GET | `/members/:id/tags` | members:view | — | Get member tags |
| POST | `/members/:id/tags/assign` | members:edit | — | Assign tag |
| DELETE | `/members/:id/tags/:tagId` | members:edit | — | Remove tag |
| GET | `/members/:id/documents` | members:view | — | Get documents |
| POST | `/members/:id/documents` | members:create | — | Upload document |
| GET | `/members/:id/referrals` | members:view | — | Get referrals |
| POST | `/members/:id/referrals` | members:create | — | Create referral |
| PATCH | `/members/:id/referrals/:referralId` | members:edit | — | Update referral |
| POST | `/members/:id/family` | members:edit | — | Add family member |
| POST | `/members/:id/assign-membership` | members:edit | — | Assign membership plan |
| POST | `/members/corporate-accounts` | members:create | — | Create corporate account |

### 5.7 Membership Plans (`/api/v1/membership-plans/`)

| Method | Path | Permission | Query Params | Description |
|--------|------|------------|--------------|-------------|
| GET | `/membership-plans` | — | `is_active`, `billing_cycle`, `search` | List plans |
| GET | `/membership-plans/type/:type` | — | — | Get plans by type |
| GET | `/membership-plans/:id` | — | — | Get plan detail |
| POST | `/membership-plans` | Roles: owner | — | Create plan |
| PATCH | `/membership-plans/:id` | Roles: owner | — | Update plan |
| DELETE | `/membership-plans/:id` | Roles: owner | — | Delete plan |

### 5.8 Check-ins (`/api/v1/check-ins/`)

| Method | Path | Permission | Query Params | Description |
|--------|------|------------|--------------|-------------|
| POST | `/check-ins` | check_ins:create | — | Manual/QR check-in |
| POST | `/check-ins/facial` | check_ins:create | — | Facial recognition check-in |
| POST | `/check-ins/sync` | check_ins:create | — | Sync offline check-ins |
| GET | `/check-ins` | check_ins:view | `branch_id`, `member_id`, `start_date`, `end_date`, `page`, `limit` | List check-ins |
| GET | `/check-ins/heatmap` | check_ins:view | `branch_id`, `start_date`, `end_date` | Check-in heatmap |

### 5.9 Payments (`/api/v1/payments/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/payments/cash` | payments:create | Record cash payment |
| POST | `/payments/create-order` | payments:create | Create Razorpay/Stripe order |
| POST | `/payments/verify` | payments:create | Verify payment callback |
| GET | `/payments` | payments:view | List payments (paginated) |
| GET | `/payments/:id/invoice` | payments:view | Get invoice |

**Query params for GET /payments:** `member_id`, `status`, `payment_method`, `start_date`, `end_date`, `page`, `limit`

### 5.10 Expenses (`/api/v1/expenses/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/expenses` | JWT only | Create expense |
| GET | `/expenses` | JWT only | List expenses (paginated) |
| PATCH | `/expenses/:id` | JWT only | Update expense |
| DELETE | `/expenses/:id` | JWT only | Delete expense |

> ⚠️ **No PermissionsGuard** — only `JwtAuthGuard` on expenses.

### 5.11 Classes (`/api/v1/classes/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/classes` | classes:create | Create class |
| GET | `/classes` | classes:view | List classes |
| GET | `/classes/:id` | classes:view | Get class detail |
| PATCH | `/classes/:id` | classes:edit | Update class |
| POST | `/classes/:id/enroll` | classes:edit | Enroll member |
| POST | `/classes/:id/cancel-enrollment` | classes:edit | Cancel enrollment |
| POST | `/classes/:id/promote-waitlist` | classes:edit | Promote from waitlist |

### 5.12 Class Templates (`/api/v1/classes/templates/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/classes/templates` | classes:create | Create template |
| GET | `/classes/templates` | classes:view | List templates |
| GET | `/classes/templates/:id` | classes:view | Get template |
| PATCH | `/classes/templates/:id` | classes:edit | Update template |
| DELETE | `/classes/templates/:id` | classes:delete | Delete template |

### 5.13 Class Sessions (`/api/v1/classes/sessions/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/classes/sessions` | classes:create | Create session |
| GET | `/classes/sessions` | classes:view | List sessions |
| GET | `/classes/sessions/:id` | classes:view | Get session |
| PATCH | `/classes/sessions/:id` | classes:edit | Update session |
| POST | `/classes/sessions/:id/cancel` | classes:edit | Cancel session |
| GET | `/classes/sessions/trainer/:trainerId/schedule` | classes:view | Trainer schedule |
| GET | `/classes/sessions/room/:studioId/schedule` | classes:view | Room schedule |
| GET | `/classes/sessions/rooms` | classes:view | List rooms |
| POST | `/classes/sessions/rooms` | classes:create | Create room |
| GET | `/classes/sessions/rooms/:id` | classes:view | Get room |
| PATCH | `/classes/sessions/rooms/:id` | classes:edit | Update room |
| GET | `/classes/sessions/recurring-rules` | classes:view | List recurring rules |
| POST | `/classes/sessions/recurring-rules` | classes:create | Create recurring rule |
| POST | `/classes/sessions/recurring-rules/:id/deactivate` | classes:edit | Deactivate rule |
| POST | `/classes/sessions/recurring-rules/generate` | classes:create | Generate sessions from rules |

### 5.14 Bookings (`/api/v1/classes/bookings/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/classes/bookings` | classes:view | List bookings |
| POST | `/classes/bookings` | classes:edit | Book a class |
| POST | `/classes/bookings/:id/cancel` | classes:edit | Cancel booking |
| GET | `/classes/bookings/session/:sessionId` | classes:view | Session bookings |
| GET | `/classes/bookings/member/:memberId` | classes:view | Member bookings |
| GET | `/classes/bookings/waitlist/:sessionId/:memberId` | classes:view | Waitlist position |
| DELETE | `/classes/bookings/waitlist/:sessionId/:memberId` | classes:edit | Remove from waitlist |

### 5.15 Attendance (`/api/v1/classes/bookings/attendance/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/classes/bookings/attendance/:sessionId` | classes:edit | Mark attendance |
| POST | `/classes/bookings/attendance/:sessionId/bulk` | classes:edit | Bulk mark attendance |
| GET | `/classes/bookings/attendance/:sessionId` | classes:view | Session attendance |
| GET | `/classes/bookings/attendance/member/:memberId` | classes:view | Member attendance history |
| POST | `/classes/bookings/attendance/:sessionId/complete` | classes:edit | Complete session |

### 5.16 Staff (`/api/v1/staff/`)

| Method | Path | Permission | Query Params | Description |
|--------|------|------------|--------------|-------------|
| GET | `/staff` | staff:view | `branch_id`, `organization_id`, `role`, `status`, `search`, `page`, `limit` | List staff |
| POST | `/staff` | staff:create | — | Create staff |
| GET | `/staff/:id` | staff:view | — | Get staff |
| PATCH | `/staff/:id` | staff:edit | — | Update staff |
| DELETE | `/staff/:id` | staff:delete | — | Deactivate (owner/brand_owner only) |
| GET | `/staff/:id/profile` | staff:view | — | Get profile |
| PATCH | `/staff/:id/profile` | staff:edit | — | Update profile |
| GET | `/staff/:id/availability` | staff:view | — | Get availability |
| POST | `/staff/:id/availability` | staff:edit | — | Set availability (array of slots) |
| GET | `/staff/:id/attendance` | staff:view | `start_date`, `end_date`, `branch_id` | Get attendance |
| POST | `/staff/attendance/check-in` | staff:create | — | Record check-in |
| PATCH | `/staff/attendance/:attendanceId/check-out` | staff:edit | — | Record check-out |

### 5.17 Staff Shifts (`/api/v1/staff/shifts/`)

| Method | Path | Permission | Query Params | Description |
|--------|------|------------|--------------|-------------|
| POST | `/staff/shifts` | staff:create | — | Create shift |
| GET | `/staff/shifts` | staff:view | `staff_id`, `branch_id`, `start_date`, `end_date` | List shifts |
| PATCH | `/staff/shifts/:id` | staff:edit | — | Update shift |
| DELETE | `/staff/shifts/:id` | staff:delete | — | Delete shift |

### 5.18 Staff Leaves (`/api/v1/staff/leaves/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/staff/leaves` | staff:create | — | Create leave request |
| GET | `/staff/leaves` | staff:view | — | List leaves (`staff_id`, `status`, `start_date`, `end_date`, `page`, `limit`) |
| PATCH | `/staff/leaves/:id/review` | staff:edit | owner, brand_owner, manager | Review leave |
| POST | `/staff/leaves/:id/cancel` | staff:edit | — | Cancel leave |

### 5.19 Payroll (`/api/v1/payroll/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| GET | `/payroll/config/:staffId` | staff:view | owner, brand_owner, manager | Get payroll config |
| POST | `/payroll/config` | staff:edit | owner, brand_owner | Upsert payroll config |
| GET | `/payroll/summary` | staff:view | owner, brand_owner, manager | Payroll summary (`branch_id`, `organization_id`) |
| POST | `/payroll/process` | staff:create | owner, brand_owner | Process payroll run |
| GET | `/payroll/records` | staff:view | owner, brand_owner, manager | Payroll records (paginated) |
| PATCH | `/payroll/records/:id` | staff:edit | owner, brand_owner | Update payroll record |
| GET | `/payroll/revenue` | staff:view | owner, brand_owner, manager | Trainer revenue report |

### 5.20 Trainer (`/api/v1/trainer/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/trainer/assign-client` | staff:edit | Assign client to trainer |
| GET | `/trainer/:id/clients` | staff:view | Get trainer's clients (`status`) |
| PATCH | `/trainer/clients/:assignmentId` | staff:edit | Update client assignment (`status` query) |
| POST | `/trainer/sessions` | staff:create | Create trainer session |
| GET | `/trainer/sessions` | staff:view | List sessions (paginated, many filters) |
| PATCH | `/trainer/sessions/:id` | staff:edit | Update session |
| GET | `/trainer/performance` | staff:view | Trainer performance (`branch_id`, `organization_id`) |
| GET | `/trainer/:id/dashboard` | staff:view | Trainer dashboard |
| POST | `/trainer/:id/performance-snapshot` | staff:create | Record snapshot (`period_start`, `period_end`) |
| GET | `/trainer/:id/performance-history` | staff:view | Performance history |

### 5.21 Branches (`/api/v1/branches/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| GET | `/branches` | branches:view | — | List branches (`organization_id`, `region_id`, `status`) |
| POST | `/branches` | branches:create | owner, brand_owner | Create branch |
| GET | `/branches/:id` | branches:view | — | Get branch |
| PATCH | `/branches/:id` | branches:edit | owner, brand_owner, regional_manager, branch_manager | Update branch |
| DELETE | `/branches/:id` | branches:delete | owner, brand_owner | Deactivate branch |
| GET | `/branches/:id/settings` | branches:view | — | Get branch settings |
| PATCH | `/branches/:id/settings` | branches:edit | owner, brand_owner, branch_manager | Update branch settings |

### 5.22 Organizations (`/api/v1/organizations/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| GET | `/organizations` | organizations:view | — | List organizations (`status`) |
| GET | `/organizations/:id` | organizations:view | — | Get organization |
| GET | `/organizations/slug/:slug` | organizations:view | — | Find by slug |
| GET | `/organizations/:id/hierarchy` | organizations:view | — | Get hierarchy |
| POST | `/organizations` | organizations:create | owner, brand_owner | Create organization |
| PATCH | `/organizations/:id` | organizations:edit | owner, brand_owner | Update organization |
| GET | `/organizations/:id/settings` | organizations:view | — | Get org settings |
| PATCH | `/organizations/:id/settings` | organizations:edit | owner, brand_owner | Update org settings |

### 5.23 Regions (`/api/v1/regions/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| GET | `/regions` | organizations:view | — | List regions (`organization_id`, `is_active`) |
| GET | `/regions/:id` | organizations:view | — | Get region |
| POST | `/regions` | organizations:create | owner, brand_owner, regional_manager | Create region |
| PATCH | `/regions/:id` | organizations:edit | owner, brand_owner, regional_manager | Update region |
| DELETE | `/regions/:id` | organizations:delete | owner, brand_owner | Deactivate region |

### 5.24 Franchise Owners (`/api/v1/franchise-owners/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| GET | `/franchise-owners` | organizations:view | — | List franchise owners |
| GET | `/franchise-owners/:id` | organizations:view | — | Get franchise owner |
| POST | `/franchise-owners` | organizations:create | owner, brand_owner | Create franchise owner |
| PATCH | `/franchise-owners/:id` | organizations:edit | owner, brand_owner | Update franchise owner |
| POST | `/franchise-owners/branch-assignments` | organizations:create | owner, brand_owner | Assign branch |
| DELETE | `/franchise-owners/:fId/branches/:bId` | organizations:delete | owner, brand_owner | Unassign branch |
| GET | `/franchise-owners/:id/branches` | organizations:view | — | Get franchise branches |

### 5.25 Dashboard (`/api/v1/dashboard/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/dashboard/kpis` | dashboard:view | KPI metrics |
| GET | `/dashboard/revenue-chart` | dashboard:view | Revenue chart data |
| GET | `/dashboard/activity-feed` | dashboard:view | Recent activity |
| GET | `/dashboard/alerts` | dashboard:view | Active alerts |
| GET | `/dashboard/branch-comparison` | dashboard:view | Branch comparison |

### 5.26 Analytics (`/api/v1/analytics/`)

| Method | Path | Permission | Query DTO | Description |
|--------|------|------------|-----------|-------------|
| GET | `/analytics/dashboard` | analytics:view | `AnalyticsQueryDto` | Dashboard summary |
| GET | `/analytics/daily-metrics` | analytics:view | `AnalyticsQueryDto` | Daily metrics |
| GET | `/analytics/daily-metrics/trend` | analytics:view | `AnalyticsQueryDto` | Metrics trend |
| GET | `/analytics/revenue` | analytics:view | `RevenueQueryDto` | Revenue analytics |
| GET | `/analytics/memberships` | analytics:view | `MembershipQueryDto` | Membership analytics |
| GET | `/analytics/classes` | analytics:view | `ClassQueryDto` | Class analytics |
| GET | `/analytics/members/behavior` | analytics:view | `MemberBehaviorQueryDto` | Member behavior |
| GET | `/analytics/members/churn-risk` | analytics:view | `branch_id` | Churn risk summary |
| GET | `/analytics/trainers` | analytics:view | `TrainerQueryDto` | Trainer analytics |
| GET | `/analytics/trainers/leaderboard` | analytics:view | `branch_id` | Trainer leaderboard |
| GET | `/analytics/campaigns` | analytics:view | `CampaignAnalyticsQueryDto` | Campaign analytics |
| GET | `/analytics/branch-comparison` | analytics:view | `organization_id`, `start_date`, `end_date` | Branch comparison |

**Common analytics query params:** `branch_id`, `organization_id`, `start_date`, `end_date`, `page`, `limit`

### 5.27 Reports (`/api/v1/reports/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/reports/export` | reports:export | Export report (CSV/PDF) — `report_type`, `format`, `branch_id`, dates |
| GET | `/reports/revenue` | reports:view | Revenue report |
| GET | `/reports/membership` | reports:view | Membership report |
| GET | `/reports/attendance` | reports:view | Attendance report |
| GET | `/reports/trainers` | reports:view | Trainer report |
| GET | `/reports/inventory` | reports:view | Inventory report |

### 5.28 Campaigns (`/api/v1/campaigns/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/campaigns` | marketing:view | List campaigns (`status`, `search`, `page`, `limit`) |
| POST | `/campaigns` | marketing:create | Create campaign |
| GET | `/campaigns/:id` | marketing:view | Get campaign |
| PATCH | `/campaigns/:id` | marketing:edit | Update campaign |
| DELETE | `/campaigns/:id` | marketing:delete | Delete campaign |
| POST | `/campaigns/:id/send` | marketing:edit | Send campaign |
| GET | `/campaigns/:id/audience` | marketing:view | Get audience (`status`, `page`, `limit`) |
| PATCH | `/campaigns/:cId/audience/:mId` | marketing:edit | Update audience status |
| GET | `/campaigns/:id/analytics` | marketing:view | Campaign analytics |

### 5.29 Leads (`/api/v1/leads/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/leads` | marketing:create | — | Create lead |
| GET | `/leads` | marketing:view | — | List leads (paginated, many filters) |
| GET | `/leads/funnel` | marketing:view | owner, brand_owner, manager | Funnel analytics |
| GET | `/leads/:id` | marketing:view | — | Get lead |
| PATCH | `/leads/:id` | marketing:edit | — | Update lead |
| POST | `/leads/:id/activities` | marketing:create | — | Add lead activity |
| GET | `/leads/:id/activities` | marketing:view | — | Get lead activities |

### 5.30 Message Templates (`/api/v1/message-templates/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/message-templates` | marketing:create | owner, brand_owner, manager | Create template |
| GET | `/message-templates` | marketing:view | — | List templates (`organization_id`, `channel`, `is_active`, `search`) |
| GET | `/message-templates/:id` | marketing:view | — | Get template |
| PATCH | `/message-templates/:id` | marketing:edit | owner, brand_owner, manager | Update template |
| DELETE | `/message-templates/:id` | marketing:delete | owner, brand_owner, manager | Delete template |

### 5.31 Automation Workflows (`/api/v1/workflows/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/workflows` | marketing:create | owner, brand_owner, manager | Create workflow |
| GET | `/workflows` | marketing:view | — | List workflows (`organization_id`, `trigger_event`, `status`) |
| GET | `/workflows/:id` | marketing:view | — | Get workflow |
| PATCH | `/workflows/:id` | marketing:edit | owner, brand_owner, manager | Update workflow |
| POST | `/workflows/:id/actions` | marketing:create | owner, brand_owner, manager | Add action |
| DELETE | `/workflows/:wId/actions/:aId` | marketing:delete | owner, brand_owner, manager | Remove action |
| DELETE | `/workflows/:id` | marketing:delete | owner, brand_owner, manager | Delete workflow |

### 5.32 Referral Programs (`/api/v1/referral-programs/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/referral-programs` | marketing:create | owner, brand_owner, manager | Create referral program |
| GET | `/referral-programs` | marketing:view | — | List programs (`organization_id`, `status`) |
| GET | `/referral-programs/stats` | marketing:view | owner, brand_owner, manager | Referral stats |
| GET | `/referral-programs/:id` | marketing:view | — | Get program |
| PATCH | `/referral-programs/:id` | marketing:edit | owner, brand_owner, manager | Update program |

### 5.33 Push Notifications (`/api/v1/push-notifications/`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/push-notifications` | marketing:create | Send push notification |
| GET | `/push-notifications/:memberId` | marketing:view | Get member notifications (`page`, `limit`) |
| PATCH | `/push-notifications/:id/read` | marketing:edit | Mark as read |

### 5.34 AI Advisor (`/api/v1/ai/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/ai/chat` | JWT only | Chat with AI advisor |
| GET | `/ai/daily-briefing` | JWT only | Get daily briefing |
| GET | `/ai/conversations` | JWT only | List conversations |

> No PermissionsGuard — all authenticated users can access AI.

### 5.35 Inventory — Products (`/api/v1/products/`, `/api/v1/product-categories/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/product-categories` | inventory:create | owner, brand_owner, manager | Create category |
| GET | `/product-categories` | inventory:view | — | List categories |
| PATCH | `/product-categories/:id` | inventory:edit | owner, brand_owner, manager | Update category |
| POST | `/products` | inventory:create | owner, brand_owner, manager | Create product |
| GET | `/products` | inventory:view | — | List products (paginated) |
| GET | `/products/barcode/:barcode` | inventory:view | — | Find by barcode |
| GET | `/products/sku/:sku` | inventory:view | — | Find by SKU |
| GET | `/products/:id` | inventory:view | — | Get product |
| PATCH | `/products/:id` | inventory:edit | owner, brand_owner, manager | Update product |

### 5.36 Inventory — Stock (`/api/v1/inventory/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| GET | `/inventory` | inventory:view | — | Get inventory (`branch_id`, `low_stock`, `page`, `limit`) |
| POST | `/inventory/adjust` | inventory:edit | owner, brand_owner, manager | Adjust inventory |
| PATCH | `/inventory/:productId/reorder-level` | inventory:edit | owner, brand_owner, manager | Update reorder level |
| GET | `/inventory/transactions` | inventory:view | — | Inventory transactions (paginated) |
| GET | `/inventory/low-stock` | inventory:view | — | Low stock alerts |

### 5.37 Inventory — Suppliers (`/api/v1/suppliers/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/suppliers` | inventory:create | owner, brand_owner, manager | Create supplier |
| GET | `/suppliers` | inventory:view | — | List suppliers (paginated) |
| GET | `/suppliers/:id` | inventory:view | — | Get supplier |
| PATCH | `/suppliers/:id` | inventory:edit | owner, brand_owner, manager | Update supplier |

### 5.38 Inventory — Purchase Orders (`/api/v1/purchase-orders/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/purchase-orders` | inventory:create | owner, brand_owner, manager | Create PO |
| GET | `/purchase-orders` | inventory:view | — | List POs (paginated) |
| GET | `/purchase-orders/:id` | inventory:view | — | Get PO |
| POST | `/purchase-orders/:id/receive` | inventory:edit | owner, brand_owner, manager | Receive PO |
| PATCH | `/purchase-orders/:id/cancel` | inventory:edit | owner, brand_owner, manager | Cancel PO |

### 5.39 POS (`/api/v1/pos/`)

| Method | Path | Permission | Roles | Description |
|--------|------|------------|-------|-------------|
| POST | `/pos/sales` | inventory:create | — | Create POS sale |
| GET | `/pos/sales` | inventory:view | — | List sales (paginated, many filters) |
| GET | `/pos/sales/daily-report` | inventory:view | owner, brand_owner, manager | Daily sales report |
| GET | `/pos/sales/top-products` | inventory:view | — | Top selling products |
| GET | `/pos/sales/:id` | inventory:view | — | Get sale detail |
| POST | `/pos/returns` | inventory:edit | owner, brand_owner, manager | Process return |

### 5.40 Roles (`/api/v1/roles/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/roles` | JWT + Roles | owner, manager | List roles |
| GET | `/roles/permissions` | JWT + Roles | owner, manager | Get permission modules |
| GET | `/roles/:id` | JWT + Roles | owner, manager | Get role |
| POST | `/roles` | JWT + Roles | owner | Create role |
| PATCH | `/roles/:id` | JWT + Roles | owner | Update role |
| DELETE | `/roles/:id` | JWT + Roles | owner | Delete role |

### 5.41 Audit Log (`/api/v1/audit/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/audit` | JWT + Roles | owner | Recent audit logs (`limit`) |
| GET | `/audit/by-module` | JWT + Roles | owner | Logs by module (`module`, `limit`) |
| GET | `/audit/by-user` | JWT + Roles | owner | Logs by user (`user_id`, `limit`) |

### 5.42 Settings (`/api/v1/settings/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/settings/studio` | JWT + Roles | — | Get studio settings |
| GET | `/settings/account` | JWT + Roles | — | Account overview |
| GET | `/settings/invoices` | JWT + Roles | owner | Platform invoices |
| GET | `/settings/branches-summary` | JWT + Roles | — | Branch summary |
| GET | `/settings/plans` | JWT + Roles | — | Available plans |
| PATCH | `/settings/studio` | JWT + Roles | owner | Update studio settings |

### 5.43 Integrations (`/api/v1/integrations/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/integrations/catalog` | JWT + Roles | owner, admin | Integration catalog |
| GET | `/integrations` | JWT + Roles | owner, admin | List integrations |
| GET | `/integrations/:id` | JWT + Roles | owner, admin | Get integration |
| POST | `/integrations` | JWT + Roles | owner | Create integration |
| PATCH | `/integrations/:id` | JWT + Roles | owner | Update integration |
| PATCH | `/integrations/:id/toggle` | JWT + Roles | owner | Toggle integration |
| POST | `/integrations/:id/test` | JWT + Roles | owner, admin | Test integration |
| DELETE | `/integrations/:id` | JWT + Roles | owner | Delete integration |

### 5.44 Webhooks (`/api/v1/webhooks/`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/webhooks/events` | JWT + Roles | owner, admin | Supported events |
| GET | `/webhooks` | JWT + Roles | owner, admin | List webhooks |
| GET | `/webhooks/:id` | JWT + Roles | owner, admin | Get webhook |
| POST | `/webhooks` | JWT + Roles | owner | Create webhook |
| PATCH | `/webhooks/:id` | JWT + Roles | owner | Update webhook |
| DELETE | `/webhooks/:id` | JWT + Roles | owner | Delete webhook |
| POST | `/webhooks/:id/rotate-secret` | JWT + Roles | owner | Rotate secret |
| GET | `/webhooks/:id/deliveries` | JWT + Roles | owner, admin | Delivery logs |
| POST | `/webhooks/deliveries/:deliveryId/retry` | JWT + Roles | owner | Retry delivery |

### 5.45 Platform (`/api/v1/platform/`)

#### Feature Flags

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/platform/feature-flags` | owner, admin | List feature flags |
| GET | `/platform/feature-flags/:key` | owner, admin | Get flag |
| GET | `/platform/feature-flags/:key/enabled` | any auth | Check if enabled |
| POST | `/platform/feature-flags` | owner | Create flag |
| PATCH | `/platform/feature-flags/:key` | owner | Update flag |
| POST | `/platform/feature-flags/bulk-toggle` | owner | Bulk toggle |
| DELETE | `/platform/feature-flags/:key` | owner | Delete flag |

#### White Label

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/platform/white-label` | owner, admin | Get white label config |
| PATCH | `/platform/white-label` | owner | Update white label |

#### SSO Providers (Platform-level)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/platform/sso-providers` | owner, admin | List SSO providers |
| GET | `/platform/sso-providers/:id` | owner, admin | Get provider |
| POST | `/platform/sso-providers` | owner | Create provider |
| PATCH | `/platform/sso-providers/:id` | owner | Update provider |
| DELETE | `/platform/sso-providers/:id` | owner | Delete provider |

#### System Notifications

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/platform/notifications` | any auth | Get notifications (`unread_only`) |
| GET | `/platform/notifications/unread-count` | any auth | Unread count |
| POST | `/platform/notifications` | owner, admin | Create notification |
| PATCH | `/platform/notifications/:id/read` | any auth | Mark as read |
| POST | `/platform/notifications/mark-all-read` | any auth | Mark all read |

---

## 6. Webhook Event Registry

Webhooks are managed via the `/api/v1/webhooks/` endpoints. Studios can subscribe to events and receive HTTP POST callbacks.

### Webhook Management

1. `GET /webhooks/events` — returns list of all supported event types
2. `POST /webhooks` — create subscription with URL + selected events
3. Each webhook gets a signing secret for HMAC verification

### Security

- All webhook deliveries are signed with HMAC
- `POST /webhooks/:id/rotate-secret` to rotate signing secret
- Delivery logs available via `GET /webhooks/:id/deliveries`
- Failed deliveries can be retried via `POST /webhooks/deliveries/:id/retry`

### Expected Event Categories

Based on the automation workflows, likely supported events include:
- `member.created`, `member.updated`, `member.deleted`
- `membership.expired`, `membership.expiring_soon`
- `payment.received`, `payment.failed`
- `check_in.created`
- `class.booked`, `class.cancelled`
- `lead.created`, `lead.status_changed`

> **Frontend note:** Call `GET /webhooks/events` to get the authoritative list at runtime.

---

## 7. Realtime Event System

**No WebSocket gateway is implemented.** The codebase does not contain any `.gateway.ts` files or Socket.IO server setup.

### Current State

- `@nestjs/websockets` and `socket.io` are listed as dependencies in the TRD but are **not yet implemented** in the backend
- Dashboard/activity feed data is fetched via polling (REST endpoints)

### Recommended Frontend Approach

Use **Supabase Realtime** for real-time updates until a custom WebSocket gateway is added:

```typescript
import { supabase } from '@/lib/supabase';

// Subscribe to table changes  
const channel = supabase
  .channel('check-ins')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'studio_{id}', table: 'check_ins' },
    (payload) => { /* handle new check-in */ }
  )
  .subscribe();
```

Alternatively, use **@tanstack/react-query** with polling:

```typescript
useQuery({
  queryKey: ['dashboard', 'activity-feed'],
  queryFn: () => api.get('/dashboard/activity-feed'),
  refetchInterval: 30_000, // Poll every 30 seconds
});
```

---

## 8. File Upload Endpoints

### Current Implementation

File uploads are handled via DTO body fields (Base64 or Supabase Storage URLs), **not multipart form data**:

| Endpoint | DTO | Description |
|----------|-----|-------------|
| `POST /members/:id/documents` | `CreateMemberDocumentDto` | Upload member document metadata |
| `POST /members/:id/face-descriptor` | Body `{ face_descriptor }` | Face recognition data (write-only, never returned) |

### Supabase Storage Pattern

Files should be uploaded directly to **Supabase Storage** from the frontend, then the storage URL/path is sent to the backend:

```typescript
// 1. Upload file to Supabase Storage
const { data, error } = await supabase.storage
  .from('member-documents')
  .upload(`${memberId}/${file.name}`, file);

// 2. Send the path to the backend
await api.post(`/members/${memberId}/documents`, {
  document_type: 'id_proof',
  file_url: data.path,
  file_name: file.name,
});
```

### Storage Buckets (from TRD)

All buckets are **private** — served via signed URLs (1-hour expiry):
- `member-documents` — ID proofs, medical records
- `member-photos` — Profile photos
- `studio-assets` — Logos, banners

---

## 9. Frontend Integration Summary

### API Client Setup

```typescript
// lib/api.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token + branch context
api.interceptors.request.use((config) => {
  const { accessToken, activeBranchId } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (activeBranchId) config.headers['X-Branch-Id'] = activeBranchId;
  return config;
});

// Handle 401 → refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refresh_token: refreshToken }
          );
          setTokens(data.access_token, data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(error.config);
        } catch { logout(); }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### React Query Setup

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s
      gcTime: 5 * 60_000,       // 5 min cache
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Query Key Convention

```typescript
// Consistent key structure: [module, action, ...params]
['members', 'list', { page, limit, status, search }]
['members', 'detail', memberId]
['members', memberId, 'body-stats']
['dashboard', 'kpis']
['classes', 'sessions', { date, trainerId }]
['payments', 'list', { page, limit, status }]
```

### Auth Store (Zustand)

```typescript
// stores/auth-store.ts
interface AuthState {
  user: JwtPayload | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeBranchId: string | null;
  
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: JwtPayload) => void;
  setBranch: (branchId: string) => void;
  logout: () => void;
  hasPermission: (module: string, action: string) => boolean;
}
```

### Route Protection Pattern

```typescript
// middleware.ts (Next.js)
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}
```

### Permission Gate Component

```typescript
// components/shared/permission-gate.tsx
function PermissionGate({ 
  module, action, children, fallback = null 
}: { 
  module: string; action: string; children: ReactNode; fallback?: ReactNode 
}) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  return hasPermission(module, action) ? children : fallback;
}

// Usage
<PermissionGate module="members" action="create">
  <Button>Add Member</Button>
</PermissionGate>
```

### Error Handling Hook

```typescript
// hooks/use-api-error.ts
function useApiError() {
  return (error: AxiosError<{ message: string | string[]; statusCode: number }>) => {
    const data = error.response?.data;
    if (!data) return toast.error('Network error');
    
    const messages = Array.isArray(data.message) ? data.message : [data.message];
    
    switch (data.statusCode) {
      case 400: toast.error(messages.join(', ')); break;
      case 401: /* handled by interceptor */ break;
      case 403: toast.error('You don't have permission'); break;
      case 404: toast.error('Not found'); break;
      case 409: toast.error(messages[0]); break;
      case 429: toast.error('Too many requests. Please wait.'); break;
      default:  toast.error('Something went wrong');
    }
  };
}
```

### Endpoint Count by Module

| Module | Endpoints |
|--------|-----------|
| Auth (all) | 39 |
| Members | 30 |
| Membership Plans | 6 |
| Check-ins | 5 |
| Payments | 5 |
| Expenses | 4 |
| Classes (all) | 38 |
| Staff (all) | 20 |
| Payroll | 7 |
| Trainer | 10 |
| Branches | 7 |
| Organizations | 8 |
| Regions | 5 |
| Franchise | 7 |
| Dashboard | 5 |
| Analytics | 12 |
| Reports | 6 |
| Campaigns | 9 |
| Leads | 7 |
| Templates/Workflows/Referrals | 17 |
| Push Notifications | 3 |
| AI | 3 |
| Inventory (Products+Stock) | 14 |
| Suppliers + POs | 9 |
| POS | 6 |
| Roles | 6 |
| Audit | 3 |
| Settings | 6 |
| Integrations | 8 |
| Webhooks | 9 |
| Platform | 18 |
| **Total** | **~332** |
