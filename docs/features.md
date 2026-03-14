# FitSync Pro — Feature Discovery Report

## Feature Inventory

### 1. Studio Onboarding & Authentication

**Description**: Complete registration, authentication, and studio setup flow.

**Files Involved**:
- Backend: `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/dto/*.ts`
- Frontend: `app/login/page.tsx`, `app/onboarding/page.tsx`, `app/forgot-password/page.tsx`
- Stores: `stores/auth-store.ts`
- Guards: `common/guards/jwt-auth.guard.ts`, `common/guards/roles.guard.ts`

**Database Tables**: `public.studios`, `branches` (first branch auto-created)

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| POST | /auth/login | Email/password login |
| POST | /auth/logout | Invalidate session |
| POST | /auth/refresh | Refresh JWT |
| POST | /auth/forgot-password | Trigger reset email |
| POST | /auth/reset-password | Complete reset with OTP |
| POST | /auth/onboarding | Register studio + owner + first branch |

**User Roles**: All (unauthenticated for login/register)

**Edge Cases**:
- 5 failed login attempts → 15-minute lockout (in-memory, resets on server restart)
- Duplicate studio name → 409 Conflict
- Onboarding creates Supabase user + Studio record + Branch in single transaction
- JWT expiry: ~1 hour (Supabase default), refresh token for session continuity

---

### 2. Branch Management

**Description**: Multi-branch support for gym chains.

**Files Involved**:
- Backend: `branches/branches.controller.ts`, `branches/branches.service.ts`
- Frontend: `components/layout/app-layout.tsx` (branch selector dropdown)

**Database Tables**: `branches`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | /branches | List all studio branches |
| POST | /branches | Create new branch |
| PATCH | /branches/:id | Update branch details |

**User Roles**: owner, manager

**Edge Cases**:
- Deleting a branch with active members is not handled
- branch_ids[] in JWT may become stale if branches are added after login

---

### 3. Member Management

**Description**: Full member lifecycle — registration, profiles, freeze, renew, deactivate.

**Files Involved**:
- Backend: `members/members.controller.ts`, `members/members.service.ts`, `members/dto/*.ts`
- Frontend: `app/members/page.tsx`, `app/members/new/page.tsx`, `app/members/[id]/page.tsx`

**Database Tables**: `members`, `member_memberships`, `membership_plans`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | /members | Paginated list with filters |
| POST | /members | Create member + assign plan |
| GET | /members/:id | Full profile with history |
| PATCH | /members/:id | Update details |
| POST | /members/:id/freeze | Freeze active membership |
| POST | /members/:id/renew | Renew with new plan |
| POST | /members/:id/face-descriptor | Store facial data (write-only) |
| GET | /members/churn-risk | Filter by churn risk level |

**User Roles**: owner, manager, front_desk

**Edge Cases**:
- Member code uniqueness: `FS-YYYYMMDD-XXXX` could collide (4-digit random)
- Freezing already frozen membership → should be rejected
- Renewing while active membership exists → old plan stays, new one created
- face_descriptor is write-only (128-float array, never returned in GET)
- Profile photos require Supabase Storage (not yet implemented)

---

### 4. Membership Plans

**Description**: Plan catalog management — create, edit, toggle active/inactive.

**Files Involved**:
- Backend: `members/plans.controller.ts`, `members/plans.service.ts`
- Frontend: `app/settings/plans/page.tsx`

**Database Tables**: `membership_plans`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | /membership-plans | List plans (optional branch filter) |
| GET | /membership-plans/:id | Plan detail |
| POST | /membership-plans | Create plan |
| PATCH | /membership-plans/:id | Update plan |
| DELETE | /membership-plans/:id | Soft delete (is_active=false) |

**User Roles**: owner, manager

**Edge Cases**:
- HTML form sends numbers as strings → backend coerces via `toIntOrNull()` helper
- Prisma Decimal `price` returns as string → frontend wraps with `Number()`
- branch_id: empty string from form → coerced to null (studio-wide plan)
- Deactivating plan with active memberships → memberships continue until expiry

---

### 5. Check-In System

**Description**: Multi-method check-in: QR code, manual search, facial recognition, offline sync.

**Files Involved**:
- Backend: `check-ins/check-ins.controller.ts`, `check-ins/check-ins.service.ts`
- Frontend: `app/check-in/page.tsx`, `app/check-in/qr/page.tsx`, `app/check-in/manual/page.tsx`, `app/check-in/facial/page.tsx`

**Database Tables**: `check_ins`, `member_memberships` (classes_remaining decrement)

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| POST | /check-ins | Standard check-in (QR/manual) |
| POST | /check-ins/facial | Facial recognition match |
| POST | /check-ins/sync | Batch sync offline check-ins |
| GET | /check-ins | Paginated history |
| GET | /check-ins/heatmap | 7×24 hourly activity grid |

**User Roles**: owner, manager, front_desk, trainer

**Edge Cases**:
- Expired membership → check-in fails with `failure_reason: 'expired'`
- No remaining classes (class_pack) → fails with `no_credits`
- Wrong branch → fails with `wrong_branch`
- Facial match threshold: Euclidean distance < 0.5
- Offline check-ins: batched, status='pending' until synced
- RFID: UI shows "Coming Soon" (greyed out)

---

### 6. Payment Processing

**Description**: Cash recording + payment gateway integration (Razorpay/Stripe).

**Files Involved**:
- Backend: `payments/payments.controller.ts`, `payments/payments.service.ts`, `payments/expenses.controller.ts`, `payments/expenses.service.ts`
- Frontend: `app/finance/page.tsx`, `app/finance/payments/page.tsx`, `app/finance/payments/new/page.tsx`, `app/finance/expenses/new/page.tsx`

**Database Tables**: `payments`, `expenses`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| POST | /payments/cash | Record cash/card/UPI payment |
| POST | /payments/create-order | Create Razorpay/Stripe order |
| POST | /payments/verify | Verify gateway payment |
| GET | /payments | Paginated payment list |
| GET | /payments/:id/invoice | Download invoice PDF |

**User Roles**: owner, manager, front_desk

**Edge Cases**:
- Receipt number: `RCP-YYYYMMDD-XXXX` could collide
- Gateway integration: stubbed (Razorpay/Stripe not wired)
- Webhook signature verification: not implemented
- Refund flow: status field supports 'refunded' but no refund endpoint
- Currency: hardcoded to INR in most frontend displays

---

### 7. Dashboard & Analytics

**Description**: Real-time KPIs, revenue trends, alerts, activity feed, branch comparison.

**Files Involved**:
- Backend: `dashboard/dashboard.controller.ts`, `dashboard/dashboard.service.ts`
- Frontend: `app/dashboard/page.tsx`, `app/dashboard/branches/page.tsx`

**Database Tables**: Cross-references all core tables (members, payments, check_ins, memberships)

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | /dashboard/kpis | Active members, revenue, attendance, expiring |
| GET | /dashboard/revenue-chart | 12-month revenue trend |
| GET | /dashboard/activity-feed | Recent activities |
| GET | /dashboard/alerts | Priority alerts array |
| GET | /dashboard/branch-comparison | Branch-level KPI breakdown |

**User Roles**: owner, manager

**Edge Cases**:
- Empty studio (no data) → KPIs return zeros, charts empty
- Revenue calculation: only `status='paid'` payments counted
- Alerts: returns `[{id, severity, message}]` format (was previously object)

---

### 8. Class Scheduling & Enrollment

**Description**: Class CRUD, trainer assignment, enrollment, waitlist management.

**Files Involved**:
- Backend: `classes/classes.controller.ts`, `classes/classes.service.ts`
- Frontend: `app/schedule/page.tsx`, `app/classes/new/page.tsx`, `app/classes/[id]/page.tsx`

**Database Tables**: `classes`, `class_enrollments`, `staff`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| POST | /classes | Create class |
| GET | /classes | List with date/branch/trainer filters |
| GET | /classes/:id | Class detail with enrollments |
| PATCH | /classes/:id | Update class |
| POST | /classes/:id/enroll | Enroll member |
| POST | /classes/:id/cancel-enrollment | Cancel enrollment |
| POST | /classes/:id/promote-waitlist | Promote from waitlist |

**User Roles**: owner, manager, trainer

**Edge Cases**:
- Trainer double-booking: conflict detection implemented
- Full class → auto-waitlist (waitlist_position assigned)
- Recurrence: RFC 5545 iCalendar format stored but not auto-expanded
- Substitute trainer assignment: field exists but UI not fully wired

---

### 9. Staff Management

**Description**: Staff directory, profiles, trainer analytics, branch assignment.

**Files Involved**:
- Backend: `staff/staff.controller.ts`, `staff/staff.service.ts`
- Frontend: `app/staff/page.tsx`, `app/staff/new/page.tsx`, `app/staff/[id]/page.tsx`, `app/staff/analytics/page.tsx`

**Database Tables**: `staff`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | /staff | Paginated list with filters |
| POST | /staff | Create staff member |
| GET | /staff/:id | Staff detail |
| PATCH | /staff/:id | Update staff |
| GET | /analytics/trainer-performance | Trainer KPIs |

**User Roles**: owner, manager

**Edge Cases**:
- `salary` field: NEVER returned in API responses unless `role === 'owner'`
- `branch_ids` is a UUID array (multi-branch assignment)
- Staff shift schedule: UI built but backend scheduling not wired
- Leave requests: UI built but no backend endpoint

---

### 10. Marketing & Campaigns

**Description**: Campaign management, audience segmentation, multi-channel delivery.

**Files Involved**:
- Backend: `marketing/marketing.controller.ts`, `marketing/marketing.service.ts`
- Frontend: `app/marketing/page.tsx`, `app/marketing/campaigns/new/page.tsx`, `app/marketing/automation/page.tsx`

**Database Tables**: `campaigns`, `notifications_log`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | /campaigns | List campaigns |
| POST | /campaigns | Create campaign (draft) |
| GET | /campaigns/:id | Campaign detail |
| PATCH | /campaigns/:id | Update (if not sent) |
| DELETE | /campaigns/:id | Delete (if draft) |
| POST | /campaigns/:id/send | Send campaign |

**User Roles**: owner, manager

**Edge Cases**:
- Cannot delete sent campaigns
- Cannot update campaigns already sent
- Segment resolution: placeholder (Twilio/WhatsApp/Resend not wired)
- Template placeholders: `{{member_name}}`, `{{expiry_date}}`

---

### 11. AI Business Advisor

**Description**: Claude-powered chat for business insights + daily briefing.

**Files Involved**:
- Backend: `ai/ai.controller.ts`, `ai/ai.service.ts`
- Frontend: `app/ai/page.tsx`, `app/ai/briefing/page.tsx`

**Database Tables**: `ai_conversations`

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| POST | /ai/chat | Send message, get AI response |
| GET | /ai/daily-briefing | Morning briefing summary |
| GET | /ai/conversations | List conversation history |

**User Roles**: owner, manager

**Edge Cases**:
- AI responses: currently mock (Anthropic SDK not wired)
- Daily briefing: returns real member/check-in counts but mock AI summary
- Conversation stored as JSON array in `messages` column
- Context window: last 10 messages sent to Claude

---

### 12. Settings & Configuration

**Description**: Studio settings, membership plan management, integration configuration.

**Files Involved**:
- Frontend: `app/settings/page.tsx`, `app/settings/plans/page.tsx`, `app/settings/integrations/page.tsx`

**Database Tables**: `public.studios`, `membership_plans`

**User Roles**: owner

**Edge Cases**:
- Studio settings update: no backend endpoint explicitly (uses `PATCH /studio`)
- Integration toggles: UI-only (no backend connection)
- Timezone/currency changes: should propagate to all date/currency displays
