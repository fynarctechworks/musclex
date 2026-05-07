# MuscleX — Full Test Scenarios

Test each scenario in order. Mark [x] when passed, note the error if failed.

---

## Phase 1: Auth & Onboarding

### 1.1 Registration
- [x] Navigate to `/register`
- [x] Submit with empty fields → should show validation errors
- [x] Submit with weak password (no uppercase/number/special) → validation error
- [x] Submit with mismatched passwords → "Passwords do not match"
- [x] Submit valid form → should redirect to `/verify-email`
- [x] Check backend console for verification link (if no Resend API key)
- [x] Verify the "Verify My Email" fallback link appears on the page

### 1.2 Email Verification
- [x] Click the verification link → should show "Verifying your email..."
- [x] Should redirect to `/onboarding/studio-info` after success
- [ ] Check you're logged in (auth token stored)
- [ ] Try using the same verification link again → should show error (token consumed)

### 1.3 Onboarding — Studio Info
- [x] `/onboarding/studio-info` loads correctly
- [x] Submit studio name, phone, address, city
- [x] Should redirect to next onboarding step

### 1.4 Onboarding — Branches
- [x] Create Branch 1 (e.g., "Iron Temple - Bandra")
- [x] Create Branch 2 (e.g., "Iron Temple - Andheri")
- [x] Both branches appear in the list
- [x] Continue to next step

### 1.5 Onboarding — Membership Plans
- [x] Create at least 2 plans (e.g., "Monthly ₹1000", "Quarterly ₹2500")
- [x] Plans appear in list
- [x] Continue to next step

### 1.6 Onboarding — Staff (optional)
- [x] Skip or add a staff member
- [x] Continue to next step

### 1.7 Onboarding — Choose Subscription
- [x] Plans load from backend (Free, Starter, Pro, Enterprise)
- [x] Select a plan
- [x] Should redirect to dashboard (`/[gymSlug]/dashboard`)

### 1.8 Login / Logout
- [ ] Logout from the app
- [ ] Navigate to `/login`
- [ ] Login with wrong password → error message
- [ ] Login with correct credentials → redirects to dashboard
- [ ] Refresh page → should stay logged in (token persisted)

---

## Phase 2: Dashboard & Branch Filtering (CRITICAL)

### 2.1 Dashboard KPIs
- [ ] Dashboard loads with KPI cards (Active Members, Monthly Revenue, Avg Attendance, Expiring Soon)
- [ ] Revenue chart section loads
- [ ] Alerts section loads
- [ ] Activity feed section loads

### 2.2 Branch Selector (Nav Bar)
- [ ] Branch dropdown in nav shows "All Branches" + each branch
- [ ] Select "All Branches" → dashboard shows aggregate data
- [ ] Select Branch 1 (e.g., Bandra) → KPIs should update
- [ ] Select Branch 2 (e.g., Andheri) → KPIs should update
- [ ] **If both branches have different members, numbers MUST differ**
- [ ] Switch back to "All Branches" → numbers should be sum of both

### 2.3 Branch Filtering on Other Pages
Test the branch selector on each page:
- [ ] Members page → member list changes per branch
- [ ] Classes page → classes filter by branch
- [ ] Staff page → staff filter by branch
- [ ] Finance page → payments/expenses filter by branch
- [ ] POS page → products/sales filter by branch
- [ ] Check-ins page (if exists) → check-ins filter by branch

---

## Phase 3: Members

### 3.1 Add Members
- [ ] Navigate to Members → "+ Add Member"
- [ ] Add Member A to **Branch 1** (e.g., "Rahul Sharma", phone: 9876543210, email)
- [ ] Add Member B to **Branch 1** (e.g., "Priya Patel", phone: 9876543211)
- [ ] Add Member C to **Branch 2** (e.g., "Vikram Singh", phone: 9876543212)
- [ ] Add Member D to **Branch 2** (e.g., "Sneha Iyer", phone: 9876543213)
- [ ] All 4 members appear in the members list
- [ ] Each member gets a member_code (format: FS-YYYYMMDD-XXXX)

### 3.2 Assign Memberships
- [ ] Click on Member A → open profile
- [ ] Assign a membership plan (e.g., "Monthly")
- [ ] Member status changes to "Active"
- [ ] Assign membership to Member B (same branch, different plan)
- [ ] Assign membership to Member C (Branch 2)
- [ ] Leave Member D without membership → status should be "inactive" or "expired"

### 3.3 Member Filters
- [ ] Status filter: "Active" → shows only active members
- [ ] Status filter: "Expired" → shows only expired/inactive members
- [ ] Status filter: "All Statuses" → shows all
- [ ] Branch filter: Branch 1 → shows only Branch 1 members
- [ ] Branch filter: Branch 2 → shows only Branch 2 members
- [ ] Branch filter: "All Branches" → shows all
- [ ] Plan filter → shows only members on that plan
- [ ] Search by name → filters correctly
- [ ] Search by phone → filters correctly
- [ ] **Combine filters**: Branch 1 + Active → correct results

### 3.4 Member Profile
- [ ] Click a member → profile page loads
- [ ] Member details (name, phone, email, branch) display correctly
- [ ] Membership info shows plan name, start/end dates
- [ ] Check-in history section exists
- [ ] Edit member → save → changes persist

### 3.5 Member Export
- [ ] Click "Export CSV" → downloads a CSV file
- [ ] CSV contains correct data matching the current filter

---

## Phase 4: Dashboard Verification (After Adding Members)

### 4.1 KPIs Update
- [ ] Dashboard shows correct "Active Members" count (3 if A, B, C have active memberships)
- [ ] Switch to Branch 1 → Active Members should be 2 (A + B)
- [ ] Switch to Branch 2 → Active Members should be 1 (C only)
- [ ] Switch to "All Branches" → Active Members should be 3
- [ ] "Expiring Soon" count is correct (members expiring within 30 days)

### 4.2 Branch Comparison
- [ ] Navigate to Dashboard → "Branch Comparison" link
- [ ] Shows each branch with active members, revenue, check-ins
- [ ] Numbers match what you see on per-branch dashboard views

---

## Phase 5: Check-Ins

### 5.1 Manual Check-In
- [ ] Navigate to Check-Ins (or use the check-in page)
- [ ] Check in Member A (active membership) → "Success"
- [ ] Check in Member A again (same day) → "Already checked in today"
- [ ] Check in Member D (no membership) → "No active membership" error

### 5.2 QR Check-In
- [ ] Member profile shows QR code
- [ ] Scan QR code on check-in page → member identified and checked in

### 5.3 Check-In with Branch Context
- [ ] Select Branch 1 in nav → check in a Branch 1 member → success
- [ ] Select Branch 1 in nav → try checking in a Branch 2 member → should fail ("wrong branch" or "Member is registered at another branch")
- [ ] Select Branch 2 → check in Branch 2 member → success

### 5.4 Check-In History
- [ ] Check-in list/table shows recent check-ins
- [ ] Filter by branch → only shows that branch's check-ins
- [ ] Filter by date range → correct results

---

## Phase 6: Payments

### 6.1 Record Payment
- [ ] Navigate to Finance → "+ Record Payment"
- [ ] Select Member A, amount ₹1000, method "cash", status "paid"
- [ ] Payment appears in recent transactions
- [ ] Record another payment for Member C (Branch 2), amount ₹2500, method "upi"

### 6.2 Payment Filters
- [ ] Select Branch 1 in nav → only Branch 1 payments show
- [ ] Select Branch 2 in nav → only Branch 2 payments show
- [ ] Select "All Branches" → all payments show

### 6.3 Finance KPIs
- [ ] Monthly Revenue card shows correct total
- [ ] Switch branches → revenue changes per branch
- [ ] Pending Payments count is correct

### 6.4 Expenses
- [ ] Navigate to Finance → "+ Add Expense"
- [ ] Add an expense (e.g., "Rent", ₹15000)
- [ ] Expense appears in list
- [ ] Net Profit = Monthly Revenue - Expenses

---

## Phase 7: POS (Point of Sale)

### 7.1 Products Setup (do in Settings/Inventory first)
- [ ] Add Product 1 (e.g., "Protein Shake ₹200") with stock quantity
- [ ] Add Product 2 (e.g., "T-Shirt ₹500") with stock quantity
- [ ] Products appear in inventory list

### 7.2 POS Terminal
- [ ] Navigate to POS → Terminal tab
- [ ] Products display in the grid
- [ ] Click product → adds to cart
- [ ] Click again → quantity increases
- [ ] Quantity cannot exceed stock
- [ ] Update quantity manually → updates correctly
- [ ] Remove item from cart → removes correctly
- [ ] Clear cart → empties all items

### 7.3 Checkout
- [ ] Add items to cart → click "Checkout"
- [ ] Select payment method (cash/card/upi)
- [ ] Optionally select a member
- [ ] Confirm → sale created
- [ ] Cart clears after successful sale
- [ ] Stock decreases by sold quantity

### 7.4 Sales History
- [ ] Switch to "Sales History" tab
- [ ] Recent sale appears in the list
- [ ] Branch filter works on sales

---

## Phase 8: Classes & Schedule

### 8.1 Create Class (Schedule Page — Google Calendar View)
- [ ] Navigate to Schedule page → Google Calendar-style weekly view loads
- [ ] Time axis (5 AM – 11 PM) visible on left side
- [ ] Day headers show Mon–Sun with dates
- [ ] Today's column has highlighted header (blue circle on date)
- [ ] Current time red line indicator visible on today's column
- [ ] Navigation: click prev/next arrows to change week
- [ ] Click "Today" button → jumps back to current week

### 8.2 Add Class via Schedule
- [ ] Click "Add Class" button in header → modal opens
- [ ] Click on a time slot (e.g., Tuesday 10 AM) → modal opens pre-filled with that date/time
- [ ] Fill form: name, category (select from dropdown — cardio/strength/flexibility/mind_body/dance/martial_arts/rehabilitation/other)
- [ ] Select branch from dropdown
- [ ] Select trainer from dropdown
- [ ] Set capacity (e.g., 20) and duration (e.g., 60 min)
- [ ] Submit → class appears on the calendar at correct position
- [ ] Class block shows: name, time, capacity badge
- [ ] Class block is color-coded by category

### 8.3 Add Class via Dedicated Page
- [ ] Navigate to Classes → "+ New Class" → `/classes/new` page loads
- [ ] Fill form with same fields as modal
- [ ] Validation: empty required fields show error messages
- [ ] Submit → redirects to schedule page → class visible

### 8.4 Past Date Validation
- [ ] Try creating a class with a past date/time → frontend shows "Cannot schedule a class in the past"
- [ ] Datetime picker does not allow selecting past dates (min attribute)
- [ ] Backend also rejects past dates (400 error)

### 8.5 Class Filters (Classes List Page)
- [ ] Navigate to Classes list page
- [ ] Status filter works (active/scheduled/cancelled)
- [ ] Category filter works
- [ ] Branch selector in nav → only shows that branch's classes

### 8.6 Class Enrollment — by Member Code
- [ ] Click on a class → details page loads
- [ ] Enrollment section shows "Member Code" and "Phone Number" toggle buttons
- [ ] Select "Member Code" mode (default)
- [ ] Enter a valid member code (e.g., FS-20260416-0001) → click Enroll → "Member enrolled" success
- [ ] Member appears in the enrolled list with name and member code
- [ ] Enter an invalid member code → "Member not found" error
- [ ] Enter same member code again → "Member is already enrolled" error

### 8.7 Class Enrollment — by Phone Number
- [ ] Switch to "Phone Number" mode
- [ ] Enter a valid phone number (e.g., 9876543210) → click Enroll → "Member enrolled"
- [ ] Member appears in enrolled list
- [ ] Enter an invalid phone number → "Member not found" error
- [ ] Press Enter key in the input → triggers enrollment (keyboard shortcut)

### 8.8 Class Enrollment — Capacity & Waitlist
- [ ] Create a class with capacity: 2
- [ ] Enroll 2 members → both show as "enrolled"
- [ ] Enroll a 3rd member → should show "Added to waitlist at position 1"
- [ ] 3rd member appears in the Waitlist section with position #1
- [ ] Cancel one enrolled member → waitlisted member auto-promoted to enrolled

### 8.9 Schedule View Verification
- [ ] Create classes at different times → all positioned correctly on calendar
- [ ] Short class (30 min) shows smaller block than long class (90 min)
- [ ] Click a class block on calendar → navigates to class detail page
- [ ] Multiple classes on same day at different times → no overlap issues

---

## Phase 9: Staff

### 9.1 Add Staff
- [ ] Navigate to Staff → "+ Add Staff"
- [ ] Add staff member with role "trainer", assigned to Branch 1
- [ ] Add another staff member for Branch 2
- [ ] Both appear in staff directory

### 9.2 Staff Filters
- [ ] Role filter: "trainer" → shows only trainers
- [ ] Role filter: "All Roles" → shows all
- [ ] Branch filter: Branch 1 → shows Branch 1 staff
- [ ] Nav branch selector → filters staff by branch

### 9.3 Staff Attendance
- [ ] Navigate to Staff → Attendance
- [ ] Record attendance for a staff member
- [ ] Attendance log shows the record

---

## Phase 10: Page-Level Dropdown Filters

Test that ALL dropdown filters on every page work correctly (not just the nav branch selector):

### Members Page
- [ ] Status dropdown: each option filters correctly
- [ ] Branch dropdown: each option filters correctly
- [ ] Tag dropdown: filters by tag
- [ ] Plan dropdown: filters by plan
- [ ] Combining multiple filters works

### Staff Page
- [ ] Role dropdown: each option filters correctly
- [ ] Branch dropdown: each option filters correctly

### Classes Page
- [ ] Status dropdown: each option filters correctly
- [ ] Category dropdown: each option filters correctly

### Finance Page
- [ ] Payment list respects nav branch selection

### Check-Ins
- [ ] Date range filter works
- [ ] Branch filter works
- [ ] Member filter works

---

## Phase 11: Edge Cases

### 11.1 Empty States
- [ ] Dashboard with no data → shows empty states / setup checklist
- [ ] Members page with no members → shows "No members found" empty state
- [ ] Classes page with no classes → shows empty state
- [ ] Schedule page with no classes → empty calendar grid with time slots visible

### 11.2 Permissions
- [ ] Owner can access all pages
- [ ] Non-owner staff (if any) → restricted by permissions
- [ ] API returns 403 for unauthorized actions

### 11.3 Session Handling
- [ ] Refresh the page → stays logged in
- [ ] Wait for token expiry → auto-refreshes token (if configured)
- [ ] Clear localStorage → redirects to login
- [ ] Multiple tabs open → branch selection syncs (or at least doesn't break)

### 11.4 Data Integrity
- [ ] Delete a member → check-ins for that member still show in history
- [ ] Freeze a member → status changes to "frozen", cannot check in
- [ ] Unfreeze → status returns to "active"
- [ ] Expire membership → member status updates to "expired"

---

## Phase 12: Performance Checks

- [ ] Dashboard loads in < 2 seconds
- [ ] Member list (with 10+ members) loads in < 1.5 seconds
- [ ] Check-in response in < 1 second
- [ ] Schedule page (Google Calendar view) loads in < 2 seconds
- [ ] Class enrollment response in < 1 second
- [ ] No console errors (browser DevTools → Console)
- [ ] No failed network requests (DevTools → Network, filter by status 4xx/5xx)

---

## Quick Reference: Test Data to Create

| Item | Branch 1 (Bandra) | Branch 2 (Andheri) |
|------|-------------------|-------------------|
| Members | Rahul Sharma (9876543210), Priya Patel (9876543211) | Vikram Singh (9876543212), Sneha Iyer (9876543213) |
| Plans | Monthly ₹1000 | Quarterly ₹2500 |
| Payments | Rahul ₹1000 cash | Vikram ₹2500 upi |
| Classes | Morning Cardio (capacity: 20, 60min) | Evening Strength (capacity: 15, 45min) |
| Staff | Trainer Amit | Trainer Kavya |
| Products | Protein Shake ₹200 | T-Shirt ₹500 |

**Class category values (must match backend enum):**
cardio, strength, flexibility, mind_body, dance, martial_arts, rehabilitation, other

**Enrollment test:** Use member code (FS-XXXXXXXX-XXXX) or phone number (9876543210)

After creating this data, the branch filtering test (Phase 2.2) should show
**different numbers** for each branch on every page.

---

## Database Reset (if needed)

To wipe all data and start fresh (keeps tables intact):
```bash
# Option 1: Node script (recommended)
cd backend && npx ts-node scripts/clean-all-data.ts

# Option 2: SQL script (run steps one at a time)
# See scripts/clean-all-data.sql

# After wiping, re-seed:
cd backend && npx prisma db seed
```
