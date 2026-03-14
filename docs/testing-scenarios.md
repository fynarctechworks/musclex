# FitSync Pro — Testing Scenarios

## Functional Tests

### FT-001: Studio Onboarding
| Field | Value |
|-------|-------|
| **Feature** | Auth / Onboarding |
| **Steps** | 1. Navigate to /onboarding 2. Fill studio name, branch details 3. Fill admin name, email, password 4. Submit |
| **Expected** | Studio created, branch created, user logged in, redirected to /dashboard |
| **Failure** | Duplicate studio name → 409 error. Missing required fields → validation errors. |

### FT-002: Login
| Field | Value |
|-------|-------|
| **Feature** | Auth / Login |
| **Steps** | 1. Navigate to /login 2. Enter email + password 3. Click Sign In |
| **Expected** | JWT stored in localStorage, redirected to /dashboard |
| **Failure** | Invalid credentials → error toast. 5+ failures → 15-min lockout message. |

### FT-003: Create Member
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | 1. Navigate to /members/new 2. Fill personal info (name, phone) 3. Select branch + plan 4. Submit |
| **Expected** | Member created with `FS-YYYYMMDD-XXXX` code, membership activated, redirected to profile |
| **Failure** | Missing required phone/name → validation error. Invalid branch_id → 400 error. |

### FT-004: Member Profile View
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | 1. Navigate to /members 2. Click on a member row |
| **Expected** | Profile page with tabs: Overview (plan, details, check-ins), Attendance, Payments, Notes |
| **Failure** | Invalid member ID → 404. Deleted member → not found. |

### FT-005: Freeze Membership
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | 1. Open member profile 2. Click "Freeze" 3. Set start/end dates + reason 4. Confirm |
| **Expected** | Membership status → 'frozen', freeze dates stored |
| **Failure** | No active membership → error. End date before start → validation error. |

### FT-006: Renew Membership
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | 1. Open member profile 2. Click "Renew" 3. Select new plan + payment method 4. Confirm |
| **Expected** | New membership created, payment recorded, old status → 'expired' |
| **Failure** | Invalid plan → 404. Missing payment method → validation error. |

### FT-007: QR Check-In
| Field | Value |
|-------|-------|
| **Feature** | Check-In |
| **Steps** | 1. Navigate to /check-in/qr 2. Enter QR code value 3. Submit |
| **Expected** | Check-in recorded, success confirmation with member name |
| **Failure** | Invalid QR → "Member not found". Expired membership → failure_reason='expired'. |

### FT-008: Manual Check-In
| Field | Value |
|-------|-------|
| **Feature** | Check-In |
| **Steps** | 1. Navigate to /check-in/manual 2. Search by name/phone 3. Select member 4. Confirm |
| **Expected** | Check-in success, member name displayed, recent check-ins updated |
| **Failure** | No active membership → error. Search yields no results → empty state. |

### FT-009: Create Membership Plan
| Field | Value |
|-------|-------|
| **Feature** | Settings / Plans |
| **Steps** | 1. Navigate to /settings/plans 2. Click "Create Plan" 3. Fill name, type, price, duration 4. Submit |
| **Expected** | Plan created, appears in table with correct price (₹), status "Active" |
| **Failure** | Missing name → validation error. Price as string → backend coerces. |

### FT-010: Record Cash Payment
| Field | Value |
|-------|-------|
| **Feature** | Payments |
| **Steps** | 1. Navigate to /finance/payments/new 2. Select member 3. Enter amount + method 4. Submit |
| **Expected** | Payment recorded with status='paid', receipt_number generated (RCP-YYYYMMDD-XXXX) |
| **Failure** | Invalid member → 404. Amount ≤ 0 → validation error. |

### FT-011: Dashboard KPIs
| Field | Value |
|-------|-------|
| **Feature** | Dashboard |
| **Steps** | 1. Login as owner 2. Navigate to /dashboard |
| **Expected** | 4 KPI cards (active members, revenue, attendance rate, expiring count), revenue chart, alerts, activity feed |
| **Failure** | No data → zeros displayed. API error → loading skeleton persists. |

### FT-012: Create Class
| Field | Value |
|-------|-------|
| **Feature** | Classes |
| **Steps** | 1. Navigate to /classes/new 2. Fill name, category, trainer, time, capacity 3. Submit |
| **Expected** | Class created, appears in weekly schedule |
| **Failure** | Trainer conflict → error. Missing required fields → validation. |

### FT-013: Enroll Member in Class
| Field | Value |
|-------|-------|
| **Feature** | Classes |
| **Steps** | 1. Open class detail 2. Click "Enroll" 3. Select member |
| **Expected** | Enrollment created with status='enrolled'. If full → waitlisted. |
| **Failure** | Already enrolled → error. No active membership → rejected. |

### FT-014: Create Staff Member
| Field | Value |
|-------|-------|
| **Feature** | Staff |
| **Steps** | 1. Navigate to /staff/new 2. Fill name, role, phone, branch assignment 3. Submit |
| **Expected** | Staff member created, appears in directory |
| **Failure** | Duplicate email → error. Invalid role → validation. |

### FT-015: Create Campaign
| Field | Value |
|-------|-------|
| **Feature** | Marketing |
| **Steps** | 1. Navigate to /marketing/campaigns/new 2. Set name, segment, channels, message 3. Save as draft |
| **Expected** | Campaign created with status='draft' |
| **Failure** | Empty message template → validation. Invalid segment → error. |

### FT-016: AI Chat
| Field | Value |
|-------|-------|
| **Feature** | AI Advisor |
| **Steps** | 1. Navigate to /ai 2. Type a business question 3. Send |
| **Expected** | AI responds with relevant business insight (currently mock response) |
| **Failure** | Empty message → send button disabled. API error → error toast. |

---

## Edge Case Tests

### EC-001: Duplicate Member Code
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | Create two members on the same day (member_code could collide) |
| **Expected** | Unique codes generated (FS-YYYYMMDD-XXXX with different XXXX) |
| **Failure** | DB unique constraint violation → 500 error (no retry logic) |

### EC-002: Expired Membership Check-In
| Field | Value |
|-------|-------|
| **Feature** | Check-In |
| **Steps** | Attempt check-in for member with expired membership |
| **Expected** | Check-in fails gracefully with `failure_reason: 'expired'` |
| **Failure** | Should NOT create success check-in record |

### EC-003: Class Pack Zero Credits
| Field | Value |
|-------|-------|
| **Feature** | Check-In |
| **Steps** | Member with class_pack (0 classes_remaining) attempts check-in |
| **Expected** | Fails with `failure_reason: 'no_credits'` |
| **Failure** | Credits should not go negative |

### EC-004: Concurrent Membership Freeze
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | Two admins simultaneously freeze the same membership |
| **Expected** | One succeeds, one gets conflict or idempotent result |
| **Failure** | Race condition → double freeze or inconsistent state |

### EC-005: Token Expiry During Session
| Field | Value |
|-------|-------|
| **Feature** | Auth |
| **Steps** | User's JWT expires while using the app |
| **Expected** | 401 response → redirect to login or auto-refresh |
| **Failure** | Currently no auto-refresh mechanism in frontend API client |

### EC-006: Empty Studio (No Data)
| Field | Value |
|-------|-------|
| **Feature** | Dashboard |
| **Steps** | Login to freshly onboarded studio with no members |
| **Expected** | Dashboard shows zeros, empty states for charts/tables |
| **Failure** | Division by zero in attendance rate calculation |

### EC-007: Large Member List Performance
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | Load member list with 500+ members |
| **Expected** | Page loads in < 1.5s with pagination (20 per page) |
| **Failure** | No DB index on member search fields → slow query |

---

## Security Tests

### SEC-001: Unauthorized API Access
| Field | Value |
|-------|-------|
| **Feature** | Auth |
| **Steps** | Call any protected endpoint without Bearer token |
| **Expected** | 401 Unauthorized response |
| **Failure** | Data leak without authentication |

### SEC-002: Cross-Tenant Data Access
| Field | Value |
|-------|-------|
| **Feature** | Multi-Tenancy |
| **Steps** | Studio A user attempts to access Studio B's member data by guessing member UUID |
| **Expected** | 404 Not Found (different schema = different data) |
| **Failure** | Tenant isolation bypass → critical data leak |

### SEC-003: Role Escalation
| Field | Value |
|-------|-------|
| **Feature** | RBAC |
| **Steps** | front_desk user attempts owner-only operations (e.g., salary view, studio settings) |
| **Expected** | 403 Forbidden |
| **Failure** | RolesGuard not applied on all sensitive endpoints |

### SEC-004: SQL Injection via Search
| Field | Value |
|-------|-------|
| **Feature** | Members / Search |
| **Steps** | Enter `'; DROP TABLE members; --` in search field |
| **Expected** | Prisma parameterized query prevents injection |
| **Failure** | Raw SQL execution → data loss |

### SEC-005: XSS in Member Notes
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | Save `<script>alert('xss')</script>` in member notes field |
| **Expected** | Rendered as text, not executed |
| **Failure** | Script execution → session hijacking |

### SEC-006: face_descriptor Exposure
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | GET /members/:id and check response body |
| **Expected** | face_descriptor field NOT present in response |
| **Failure** | Biometric data leak → privacy violation |

### SEC-007: Salary Exposure
| Field | Value |
|-------|-------|
| **Feature** | Staff |
| **Steps** | Non-owner user calls GET /staff/:id |
| **Expected** | salary field stripped from response |
| **Failure** | Salary leak to unauthorized users |

### SEC-008: JWT Token Tampering
| Field | Value |
|-------|-------|
| **Feature** | Auth |
| **Steps** | Modify JWT payload (change studio_id) and send to API |
| **Expected** | Token verification fails (Supabase validates signature) |
| **Failure** | Studio impersonation |

---

## Performance Tests

### PERF-001: Dashboard Load (10 users)
| Field | Value |
|-------|-------|
| **Feature** | Dashboard |
| **Steps** | 10 concurrent users load /dashboard |
| **Expected** | < 2s response time for all KPI endpoints |
| **Target** | P95 < 2s |

### PERF-002: Member List (100 users, 500 members)
| Field | Value |
|-------|-------|
| **Feature** | Members |
| **Steps** | 100 concurrent users paginate through 500-member list |
| **Expected** | < 1.5s per page load |
| **Target** | P95 < 1.5s |

### PERF-003: Check-In Burst (1000 check-ins/min)
| Field | Value |
|-------|-------|
| **Feature** | Check-In |
| **Steps** | Simulate 1000 check-ins per minute at a busy gym |
| **Expected** | < 1s per check-in confirmation |
| **Target** | P99 < 1s |

### PERF-004: Database Query Performance
| Field | Value |
|-------|-------|
| **Feature** | All |
| **Steps** | Monitor Supabase query latency under load |
| **Expected** | All queries < 100ms P95 |
| **Target** | P95 < 100ms |

---

## Failure Scenarios

### FAIL-001: Payment Gateway Timeout
| Field | Value |
|-------|-------|
| **Feature** | Payments |
| **Steps** | Razorpay/Stripe API returns timeout during create-order |
| **Expected** | User shown error toast, payment status stays 'pending', retry option |
| **Failure** | Orphaned payment record with no gateway reference |

### FAIL-002: Database Connection Loss
| Field | Value |
|-------|-------|
| **Feature** | All |
| **Steps** | Supabase PostgreSQL becomes unreachable |
| **Expected** | API returns 503 Service Unavailable, frontend shows error state |
| **Failure** | Currently: PrismaService warns on init but unhandled errors on queries |

### FAIL-003: Offline Check-In Sync Failure
| Field | Value |
|-------|-------|
| **Feature** | Check-In |
| **Steps** | Offline check-ins queued, sync endpoint returns partial failure |
| **Expected** | Successful syncs confirmed, failed ones retry, user notified |
| **Failure** | Check-ins lost if sync completely fails |

### FAIL-004: Supabase Auth Outage
| Field | Value |
|-------|-------|
| **Feature** | Auth |
| **Steps** | Supabase Auth service down, users cannot login |
| **Expected** | Clear error message, existing sessions continue until JWT expiry |
| **Failure** | All authenticated API calls fail (JwtAuthGuard calls Supabase) |

### FAIL-005: AI API Rate Limit
| Field | Value |
|-------|-------|
| **Feature** | AI Advisor |
| **Steps** | Multiple studios simultaneously hit Claude API |
| **Expected** | Rate limit error handled gracefully, user shown "try again later" |
| **Failure** | Currently: mock responses, will need handling when Claude wired |
