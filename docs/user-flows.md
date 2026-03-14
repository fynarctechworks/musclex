# FitSync Pro — User Flow Analysis

## 1. New Member Onboarding Flow

```
Studio Owner/Manager                    System
        │                                  │
        ├── Navigate to /members/new ──────►
        │                                  │
        ├── Fill Personal Info ────────────►
        │   (name*, phone*, email,         │
        │    DOB, emergency contact)       │
        │                                  │
        ├── Select Branch* ────────────────►
        │                                  │
        ├── Select Membership Plan ────────►
        │   (shows plan name, price,       │
        │    duration, type)               │
        │                                  │
        ├── Set Start Date ────────────────►
        │                                  │
        ├── Click "Create Member" ─────────►
        │                                  ├── Generate member_code (FS-YYYYMMDD-XXXX)
        │                                  ├── Generate QR code (UUID)
        │                                  ├── Create Member record
        │                                  ├── Create MemberMembership record
        │                                  ├── Set status = 'active'
        │                                  │
        ◄── Redirect to /members/:id ──────┤
        │                                  │
        ├── (Optional) Upload Photo ───────►
        ├── (Optional) Enroll Face ────────►
        │   (3 photos → 128-float          │
        │    descriptor → POST             │
        │    /members/:id/face-descriptor) │
        │                                  │
        ├── (Optional) Record Payment ─────►
        │   (cash/card/UPI)                │
        │                                  │
        ◄── Member Ready ─────────────────┘
```

### Key Decision Points
- If no plan selected → member created without active membership
- If plan is class_pack → classes_remaining set from plan.total_classes
- If plan has duration_days → end_date auto-calculated from start_date

---

## 2. Front Desk / Trainer Workflow

```
Front Desk Staff                       System
        │                                  │
        ├── Login (/login) ────────────────►
        │                                  ├── Verify credentials (Supabase Auth)
        │                                  ├── Return JWT + user metadata
        ◄── Redirect to /dashboard ────────┤
        │                                  │
    ┌───┤   MAIN LOOP (Daily)              │
    │   │                                  │
    │   ├── Check Dashboard ───────────────►
    │   │   (KPIs, alerts, activity feed)  │
    │   │                                  │
    │   ├── Process Check-Ins ─────────────►
    │   │   ├── QR Scan (/check-in/qr)    │
    │   │   │   └── Member scans QR ───────► Validate → Success/Fail
    │   │   ├── Manual (/check-in/manual)  │
    │   │   │   └── Search → Select ───────► Validate → Success/Fail
    │   │   └── Face ID (/check-in/facial) │
    │   │       └── Camera → Match ────────► Euclidean distance < 0.5
    │   │                                  │
    │   ├── Handle Walk-Ins ───────────────►
    │   │   └── /members/new → Quick Reg   │
    │   │                                  │
    │   ├── Process Payments ──────────────►
    │   │   └── /finance/payments/new      │
    │   │       (cash/card/UPI recording)  │
    │   │                                  │
    │   ├── Handle Inquiries ──────────────►
    │   │   └── /members?search=...        │
    │   │       (lookup by name/phone/ID)  │
    │   │                                  │
    └───┤── End of Day                     │
        │                                  │
        ├── Logout ────────────────────────►
        │                                  │
```

### Check-In Validation Rules
1. Member must have active membership (status = 'active')
2. Membership end_date must be >= today
3. If class_pack: classes_remaining > 0 (decremented on success)
4. If branch-specific: member's branch must match check-in branch

---

## 3. Admin/Owner Workflow

```
Studio Owner                           System
        │                                  │
        ├── Login ─────────────────────────►
        │                                  │
    DAILY ROUTINE                          │
        │                                  │
        ├── Review Dashboard ──────────────►
        │   ├── KPIs (members, revenue)    │
        │   ├── Alerts (expiring, churn)   │
        │   └── Activity Feed              │
        │                                  │
        ├── AI Briefing (/ai/briefing) ────►
        │   (daily summary, recommendations)│
        │                                  │
        ├── Check Alerts ──────────────────►
        │   ├── Expiring memberships       │
        │   ├── High churn risk members    │
        │   └── Payment failures           │
        │                                  │
    WEEKLY ROUTINE                         │
        │                                  │
        ├── Review Revenue Chart ──────────►
        │   (12-month trend)               │
        │                                  │
        ├── Branch Comparison ─────────────►
        │   (/dashboard/branches)          │
        │                                  │
        ├── Trainer Performance ───────────►
        │   (/staff/analytics)             │
        │                                  │
        ├── Manage Staff Schedule ─────────►
        │   (/staff — shifts, leave)       │
        │                                  │
    MONTHLY ROUTINE                        │
        │                                  │
        ├── Review Financial Dashboard ────►
        │   (/finance — revenue, expenses) │
        │                                  │
        ├── Manage Plans ──────────────────►
        │   (/settings/plans — pricing)    │
        │                                  │
        ├── Launch Campaign ───────────────►
        │   (/marketing/campaigns/new)     │
        │                                  │
        ├── AI Advisor Chat ───────────────►
        │   (/ai — business questions)     │
        │                                  │
```

---

## 4. Payment Workflow

```
Admin/Front Desk                       System
        │                                  │
    CASH/UPI/CARD (Manual Recording)       │
        │                                  │
        ├── /finance/payments/new ─────────►
        ├── Select Member ─────────────────►
        ├── Enter Amount ──────────────────►
        ├── Select Method ─────────────────►
        │   (cash | card | upi |           │
        │    bank_transfer)                │
        ├── Submit ────────────────────────►
        │                                  ├── Generate receipt_number
        │                                  ├── Create Payment (status=paid)
        │                                  ├── Link to membership (if applicable)
        ◄── Success + Receipt Number ──────┤
        │                                  │
    ONLINE PAYMENT (Razorpay/Stripe)       │
        │                                  │
        ├── POST /payments/create-order ───►
        │                                  ├── Create pending Payment record
        │                                  ├── Create gateway order
        ◄── Return order_id + key ─────────┤
        │                                  │
        ├── Client opens Razorpay/Stripe ──►
        │   checkout UI                    │
        │                                  │
        ├── Payment completed ─────────────►
        │                                  │
        ├── POST /payments/verify ─────────►
        │                                  ├── Verify gateway signature
        │                                  ├── Update Payment → status=paid
        │                                  ├── Activate/Extend membership
        ◄── Success confirmation ──────────┤
        │                                  │
    NOTE: Gateway integration is stubbed.  │
    Razorpay/Stripe SDK not yet wired.     │
```

---

## 5. Attendance (Check-In) Workflow

```
                    ┌──────────────────┐
                    │  /check-in (hub) │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌───────────┐   ┌──────────────┐  ┌──────────────┐
    │  QR Scan  │   │  Manual      │  │  Face ID     │
    │  /qr      │   │  /manual     │  │  /facial     │
    └─────┬─────┘   └──────┬───────┘  └──────┬───────┘
          │                │                  │
          ▼                ▼                  ▼
    ┌──────────────────────────────────────────────┐
    │              POST /check-ins                  │
    │                                              │
    │  Input: member_id OR qr_code OR descriptor   │
    │         + branch_id + checkin_method          │
    │                                              │
    │  Validation:                                 │
    │  1. Resolve member (by ID, QR, or face match)│
    │  2. Find active membership                   │
    │  3. Check end_date >= today                  │
    │  4. Check classes_remaining > 0 (if pack)    │
    │  5. Check branch match                       │
    │                                              │
    │  On Success:                                 │
    │  - Create CheckIn (status=success)           │
    │  - Decrement classes_remaining (if pack)     │
    │  - Return member name + confirmation         │
    │                                              │
    │  On Failure:                                 │
    │  - Create CheckIn (status=failed)            │
    │  - Set failure_reason (expired/no_credits/   │
    │    wrong_branch)                             │
    │  - Return error message                      │
    └──────────────────────────────────────────────┘

    OFFLINE FLOW:
    - Check-ins queued in IndexedDB (idb library)  [NOT YET WIRED]
    - POST /check-ins/sync when back online
    - Batch process with success/fail counters
```

---

## 6. Membership Renewal Workflow

```
System (Automated Alert)               Admin/Owner
        │                                  │
        ├── Dashboard Alert ───────────────►
        │   "14 members expiring in 7 days"│
        │                                  │
        │                                  ├── Click alert → /members list
        │                                  │   (filtered by expiring status)
        │                                  │
        │                                  ├── Open member profile
        │                                  │
        │                                  ├── Click "Renew"
        │                                  │
        │                                  ├── Select new plan
        │                                  │
        │                                  ├── Select payment method
        │                                  │
        │                                  ├── Confirm ─────────────────►
        │                                  │                            │
        │                                  │   ├── Create new MemberMembership
        │                                  │   ├── Set old membership → expired
        │                                  │   ├── Create Payment record
        │                                  │   ├── Calculate new end_date
        │                                  │   ├── Update member status → active
        │                                  │   │
        │                                  ◄── Success notification ────┤
        │                                  │

    AUTO-RENEW (PLANNED, NOT IMPLEMENTED):
    - Plan has auto_renew_enabled = true
    - Member has auto_renew = true + payment_method_token
    - BullMQ cron job checks expiring memberships daily
    - Charges saved payment method automatically
    - Creates new membership + payment on success
```
