# Test Scenarios

## 1. Signup -> Onboarding -> Dashboard
- **Steps:**
  1. POST /api/v1/auth/register with valid owner credentials
  2. Complete onboarding (studio name, branch, plan selection)
  3. Verify redirect to dashboard
- **Expected:** User created, studio schema provisioned, dashboard loads with empty state KPIs

## 2. Login -> Dashboard
- **Steps:**
  1. POST /api/v1/auth/login with valid credentials
  2. Verify JWT returned
  3. GET /api/v1/dashboard
- **Expected:** 200 with KPI data, activity feed, alerts

## 3. Login Lockout
- **Steps:**
  1. POST /api/v1/auth/login with wrong password x5
  2. Attempt 6th login with correct password
- **Expected:** 429 or 403 for 15 minutes

## 4. Create Branch
- **Steps:**
  1. Auth as owner
  2. POST /api/v1/branches with branch details
  3. GET /api/v1/branches
- **Expected:** Branch appears in list, linked to studio

## 5. Create Staff
- **Steps:**
  1. Auth as owner/admin
  2. POST /api/v1/staff with staff details + role
  3. GET /api/v1/staff
- **Expected:** Staff created with assigned role, salary hidden unless requester is owner

## 6. Create Member
- **Steps:**
  1. Auth as owner/admin/staff
  2. POST /api/v1/members with member details
  3. Verify member_id format: FS-YYYYMMDD-XXXX
- **Expected:** Member created, appears in member list

## 7. Upload Member Photo
- **Steps:**
  1. Auth as owner/admin/staff
  2. POST /api/v1/members/:id/photo with image file
  3. GET member profile
- **Expected:** Photo stored in Supabase Storage, signed URL returned

## 8. Create Subscription Plan
- **Steps:**
  1. Auth as owner
  2. POST /api/v1/plans with plan details (name, duration, price)
  3. GET /api/v1/plans
- **Expected:** Plan created, available for assignment

## 9. Assign Plan to Member
- **Steps:**
  1. Auth as owner/admin
  2. POST /api/v1/members/:id/assign-plan with plan_id
  3. GET member profile
- **Expected:** Plan linked, expiry date calculated, status = active

## 10. Check-in (QR)
- **Steps:**
  1. Generate QR for member
  2. POST /api/v1/check-ins with qr_code payload
- **Expected:** Check-in recorded in < 2s, confirmation returned

## 11. Record Payment
- **Steps:**
  1. Auth as owner/admin
  2. POST /api/v1/payments with member_id, amount, method (cash|card|upi|bank_transfer|razorpay|stripe)
  3. Verify receipt number format: RCP-YYYYMMDD-XXXX
- **Expected:** Payment recorded, receipt generated

## 12. Logout -> Re-login
- **Steps:**
  1. POST /api/v1/auth/logout
  2. Attempt authenticated request with old token
  3. POST /api/v1/auth/login with valid credentials
- **Expected:** Old token rejected (401), new token works
