🏋️

**MUSCLEX**

Gym Owner Management Platform

Product Requirements Document \| v1.0 \| 2025

Prepared for:

Fitness Studio Owners · Staff Managers · Multi-Branch Operators

**📊 Section 1: Project Overview**

MuscleX is a cloud-native, AI-powered management platform built
exclusively for fitness studio owners --- including yoga studios,
CrossFit boxes, dance academies, and boutique gyms. It acts as a single
digital command center, replacing fragmented spreadsheets, messaging
apps, and paper registers with one intelligent operating system.

> **🎯 One-Line Vision:** The OS for fitness businesses --- run, grow,
> and analyze your studio from a single, intelligent dashboard.

**1.1 Product Summary**

  ---------------------- ------------------------------------------------
  **Attribute**          **Detail**

  Product Name           MuscleX

  Version                1.0 (Full Launch)

  Platform(s)            Web App (Desktop) · iOS Native · Android Native

  Primary User           Fitness Studio Owner / Gym Manager / Staff

  Timeline               6+ months (phased delivery --- 3 phases)

  Business Model         SaaS subscription (monthly / annual tiers)

  Multi-location         Yes --- supported from Day 1

  Member App             Out of scope (Phase 4 roadmap)
  ---------------------- ------------------------------------------------

**🎯 Section 2: Product Vision**

> **Vision Statement:** To build the most intelligent fitness studio
> operating system --- enabling owners to run every aspect of their
> business effortlessly through automation, real-time analytics, and
> AI-powered insights.

**2.1 Problem Statement**

Fitness studio owners today rely on fragmented, manual, and disconnected
tools that create the following critical pain points:

-   Manual membership tracking in spreadsheets leads to missed renewals
    and revenue leakage

-   No single view of financial health --- expenses, revenue, and
    profitability tracked across multiple tools

-   Staff and trainer scheduling done via WhatsApp or paper, causing
    miscommunication and no-shows

-   Member churn is invisible --- owners have no early warning system
    for dropping engagement

-   Marketing is reactive and uncoordinated --- no automated reminders,
    campaigns, or referral systems

-   Multi-branch owners have zero consolidated visibility across
    locations

-   Decision-making is gut-based, not data-driven --- no AI or analytics
    support

**2.2 Opportunity**

The global gym management software market is growing rapidly as fitness
studios modernize. No dominant player combines operations, financials,
AI analytics, and marketing in a single mobile-first platform designed
for boutique studio owners. MuscleX captures this gap.

**👤 Section 3: Target Users**

**3.1 Primary User --- Fitness Studio Owner**

  ---------------------- ------------------------------------------------
  **Attribute**          **Detail**

  Who                    Owner/operator of yoga studio, CrossFit box,
                         dance academy, or boutique gym

  Age Range              28--50 years old

  Technical Comfort      Moderate --- comfortable with smartphones and
                         web apps; not developers

  Studios Managed        1--10 locations

  Members per Studio     50--1,000 active members

  Core Pain Points       Admin overload, missed renewals, no financial
                         visibility, high churn

  Goal                   Spend less time on admin; grow studio revenue;
                         retain members longer
  ---------------------- ------------------------------------------------

**3.2 Secondary Users**

**Studio Manager / Admin Staff**

-   Handles day-to-day operations: check-ins, registrations, payment
    collection

-   Needs: Fast member lookup, attendance marking, payment recording

-   Access level: Operational --- no financial settings or AI dashboards

**Trainer / Instructor**

-   Manages their class schedules, views assigned members, tracks
    attendance

-   Needs: Class roster, member check-in view, schedule overview

-   Access level: Limited --- own schedule and assigned classes only

**3.3 User Personas**

> **Persona 1 --- Priya:** \"I run a 300-member yoga studio and spend 3
> hours a day on WhatsApp chasing renewals. I need everything in one
> place.\"
>
> **Persona 2 --- Karan:** \"I own 4 CrossFit boxes. I have no idea how
> Box 3 is performing compared to Box 1. I need consolidated numbers.\"
>
> **Persona 3 --- Aisha:** \"I just hired 3 trainers. I have no way to
> measure if they\'re actually performing. I\'m flying blind.\"

**✨ Section 4: Core Features**

All features below are REQUIRED for the v1.0 launch. Each feature
includes exact specifications for implementation.

**Feature 1: Multi-Branch Dashboard (Command Center)**

> **Purpose:** Unified overview of all studio locations --- financial
> health, attendance, member activity, and alerts in one screen.

**1.1 Global Overview (Web --- Desktop Primary)**

-   Top navigation: Branch selector dropdown (shows All Locations or
    individual branch)

-   4 hero KPI cards: Total Active Members \| Monthly Revenue \| Avg
    Attendance Rate \| Expiring Soon (next 7 days)

-   Revenue chart: Bar/line chart --- last 12 months, filterable by
    branch

-   Member activity feed: Last 10 check-ins with name, branch,
    timestamp, check-in method

-   Alert panel: Members 7+ days inactive, overdue payments, expiring
    memberships (auto-refreshed every 60 seconds)

-   Branch performance table: Side-by-side comparison of all locations

**1.2 Mobile Dashboard**

-   Condensed view: 4 KPI tiles + today\'s class schedule + 5 recent
    alerts

-   Bottom navigation: Dashboard \| Members \| Schedule \| Finance \| AI
    Chat

-   Pull-to-refresh enabled; all data synced in real time via WebSockets

**Feature 2: Member Management**

**2.1 Member Registration**

-   Fields: Full name, phone (mandatory), email, date of birth,
    emergency contact, profile photo (optional)

-   Membership plan selector: Choose from active plans (duration, price,
    class credits)

-   Check-in method assignment: QR / RFID card number / biometric
    enrollment flag

-   Auto-generate unique member ID (format: FS-YYYYMMDD-XXXX)

-   Registration completes in \< 3 minutes for staff

**2.2 Member Profile**

-   Full history: all payments, attendance records, membership renewals,
    notes

-   Status badge: Active / Expiring Soon / Expired / Frozen

-   Quick actions: Renew, Freeze, Send Message, Edit, Deactivate

-   Engagement score (0--100): Calculated from attendance frequency over
    last 30 days

**2.3 Membership Plans**

-   Create unlimited plan types: Monthly, Quarterly, Annual, Class Pack
    (e.g., 10 sessions)

-   Fields per plan: Name, Duration (days), Price, Max Classes/Week,
    Description, Active toggle

-   Plan can be branch-specific or global across all locations

-   Freeze option: Pause membership for N days (medical, travel) ---
    extends end date automatically

**Feature 3: Smart Check-In System**

**3.1 Check-In Methods (all 4 must work at launch)**

  ----------------- -------------------------- --------------------------
  **Method**        **How It Works**           **Hardware Required**

  QR Code           Member shows QR from       Any smartphone/tablet with
                    email/printout; staff      camera
                    scans via device camera    

  RFID Card         Member taps card on USB    USB RFID reader (125kHz or
                    RFID reader connected to   13.56MHz)
                    front desk tablet          

  Facial            Camera captures face;      Webcam / tablet front
  Recognition       matched against enrolled   camera
                    member photo via on-device 
                    ML                         

  Manual Check-In   Staff searches member      None --- staff device only
                    name/ID and taps \"Check   
                    In\" button                
  ----------------- -------------------------- --------------------------

**3.2 Check-In Logic**

1.  Member identified via chosen method

2.  System validates: membership active? classes remaining? correct
    branch?

3.  If valid: check-in logged with timestamp, method, branch --- green
    confirmation shown

4.  If invalid: red alert shown with reason (Expired / No Credits /
    Wrong Branch)

5.  Attendance data synced to dashboard within 5 seconds

**3.3 Attendance Analytics**

-   Peak hours heatmap: 7-day grid showing check-in density by hour

-   Class occupancy rate per session

-   Member attendance streaks and last-visit date visible on profile

**Feature 4: Class & Schedule Management**

**4.1 Class Creation**

-   Fields: Class name, Category (Yoga/CrossFit/Dance/HIIT/etc.),
    Trainer, Branch, Capacity (max members), Duration (minutes),
    Recurrence (one-time / weekly / custom), Room/area

-   Calendar view: Weekly and monthly views with drag-and-drop
    scheduling

-   Conflict detection: Alert if trainer is double-booked or room is at
    capacity

**4.2 Class Enrollment**

-   Members assigned to classes from their profile or from the class
    roster view

-   Waitlist support: When class is full, members can be added to
    waitlist --- auto-promoted when spot opens

-   Check-in against class roster: Only enrolled members (or walk-ins
    approved by staff) can check in to a class

**4.3 Trainer Assignment**

-   Each class requires exactly 1 primary trainer (substitute trainer
    optional)

-   Trainer schedule view: Calendar showing all assigned classes for the
    week

-   Substitute workflow: Reassign class to another available trainer
    with 1-click notification

**Feature 5: Financial Management**

**5.1 Payment Recording**

-   Payment methods supported: Cash, Card (manual entry), Online
    (gateway), Bank Transfer

-   For each payment: Member, Plan, Amount, Method, Date, Receipt
    number, Branch, Notes

-   Partial payments: Flag as Partial --- track outstanding balance

-   Overdue tracker: Members with outstanding balances surface in alert
    panel

**5.2 Online Payment Gateway**

-   Integrate Razorpay (India-primary) and Stripe (international) ---
    configurable by owner

-   Payment link generation: One-click shareable link sent via
    SMS/WhatsApp/Email

-   Auto-capture: Payment confirmed → membership auto-activated or
    renewed

-   Webhook handling: Real-time status updates (Paid / Failed / Pending)

**5.3 Auto-Renewal & Subscriptions**

-   Owner sets auto-renewal toggle per membership plan

-   3 days before expiry: Member receives reminder (SMS + Email + Push)

-   1 day before expiry: Second reminder

-   On expiry: If auto-renew ON and saved payment method exists, charge
    and renew silently

-   On failure: Alert owner and send member manual payment link

**5.4 Invoice & PDF Export**

-   Auto-generate invoice on every payment: Member name, plan, dates,
    amount, receipt number, studio branding

-   PDF download from any payment record

-   Bulk export: All invoices for a date range as ZIP file

-   Monthly financial summary PDF: Revenue, expenses, net profit per
    branch

**5.5 Expense Tracking**

-   Expense categories: Salaries, Rent, Equipment, Utilities, Marketing,
    Maintenance, Other

-   Add expense: Amount, Category, Date, Branch, Description, Attachment
    (photo of receipt)

-   Expense vs Revenue dashboard: Monthly P&L chart with net profit line

**Feature 6: Trainer & Staff Management**

**6.1 Staff Profiles**

-   Fields: Name, Role (Owner / Manager / Trainer / Front Desk), Phone,
    Email, Joining Date, Branch assignment(s), Salary (private --- owner
    only)

-   Access control: Role determines which modules are visible (see
    Section 7)

**6.2 Trainer Performance Dashboard**

-   Metrics tracked per trainer: Classes taught (monthly), Avg class
    occupancy %, Member attendance rate for their classes, Member
    ratings (1--5 stars), No-show rate

-   Performance score (0--100): Composite of all metrics, updated weekly

-   Trainer comparison table: Rank all trainers across branches

**6.3 Staff Scheduling**

-   Shift scheduler: Assign start/end times per day per staff member

-   Attendance tracker: Mark staff present/absent

-   Leave requests: Staff submits → manager approves/rejects in-app

**Feature 7: Marketing & Growth Automation**

**7.1 Automated Communication Triggers**

  ---------------------- ---------------- ---------------- ---------------
  **Trigger**            **Channel**      **Timing**       **Editable?**

  Membership expiring    SMS + Email +    7d, 3d, 1d       Yes
                         Push             before           

  Payment received       SMS + Email      Instant          Yes

  Member inactive 7+     WhatsApp + Push  Day 7 & Day 14   Yes
  days                                                     

  Birthday greeting      SMS + Email      Day of birthday  Yes

  New class added        Push             Instant          No

  Welcome message        SMS + Email      On registration  Yes
  ---------------------- ---------------- ---------------- ---------------

**7.2 Campaign Manager**

-   Create broadcast campaigns: Target segment (All / By Plan / By
    Branch / By Inactive status)

-   Message editor: Template with variables ({{member_name}},
    {{expiry_date}}, etc.)

-   Schedule or send immediately

-   Delivery report: Sent / Delivered / Failed counts

**7.3 Referral Program**

-   Referral code: Each member gets unique code; shareable via link

-   Reward configuration: Owner sets reward (e.g., 1 free month after 3
    referrals)

-   Referral tracking: Dashboard shows code usage, converted members,
    rewards earned

-   Auto-apply reward: When referral count reached, reward added to
    referrer\'s membership

**Feature 8: AI Business Advisor (Must-Have at Launch)**

**8.1 Conversational AI Chat (Claude API Integration)**

-   Floating chat button on all screens --- opens AI assistant panel

-   Context-aware: AI has access to the studio\'s real-time data
    (members, revenue, attendance)

-   Natural language queries --- no training required for owner

**8.2 Example AI Queries Supported**

  ----------------------------------- -----------------------------------
  **Owner Asks**                      **AI Responds With**

  \"How many members are expiring     List + count of members, with quick
  this week?\"                        action to send reminders

  \"Which branch made the most        Branch comparison with % difference
  revenue in March?\"                 and trend

  \"Who are my most at-risk           Members ranked by inactivity + last
  members?\"                          visit date

  \"Which trainer has the best        Trainer performance comparison
  retention rate?\"                   across studios

  \"Summarize last month\'s           P&L snapshot + attendance + member
  performance\"                       growth narrative

  \"What time is peak attendance at   Heatmap data in text form with
  Branch 2?\"                         staffing recommendations
  ----------------------------------- -----------------------------------

**8.3 AI Proactive Alerts**

-   Each morning at 8 AM: AI pushes \"Daily Studio Briefing\" to
    owner\'s phone with 3 priority items

-   Weekly insight: Auto-generated performance summary with comparison
    to prior week

-   Anomaly detection: AI flags unusual drops in attendance, unexpected
    revenue dips, or sudden member inactivity spikes

**Feature 9: Member Retention Intelligence**

**9.1 Churn Risk Scoring**

-   Every member gets a Churn Risk Score (Low / Medium / High) updated
    daily

-   Score factors: Days since last visit (weighted 40%), Attendance
    trend (30%), Payment delays (20%), Plan type (10%)

-   High risk members surface in dashboard alert panel with 1-click
    \"Re-engage\" action

**9.2 Retention Campaigns**

-   \"Win Back\" template: Pre-built message for inactive members with
    special offer placeholder

-   Auto-trigger: After 14 days of inactivity, system prompts owner to
    run win-back campaign

-   Track results: Members who returned after campaign are flagged ---
    measure ROI

**📱 Section 5: Screen Inventory**

Complete list of all screens required for v1.0 launch across Web, iOS,
and Android.

**5.1 Authentication & Onboarding (3 screens)**

-   S01 --- Login Screen: Email/password, \"Forgot password\", Studio
    logo

-   S02 --- Onboarding Setup: Studio name, branch setup, admin profile,
    subscription plan selection

-   S03 --- Forgot Password / Reset: Email entry → OTP → new password

**5.2 Dashboard & Overview (3 screens)**

-   S04 --- Main Dashboard: KPI cards, revenue chart, alert panel,
    recent activity feed

-   S05 --- Branch Selector View: All-branches comparison table +
    per-branch drill-down

-   S06 --- AI Chat Overlay: Floating panel accessible from all screens

**5.3 Member Management (5 screens)**

-   S07 --- Member List: Search, filter
    (Active/Expiring/Expired/Frozen), sort, export CSV

-   S08 --- Member Profile: Full detail, history, quick actions

-   S09 --- Add/Edit Member: Registration form, plan assignment,
    check-in method setup

-   S10 --- Check-In Screen: Dedicated staff tablet view for front desk

-   S11 --- Churn Risk List: Filtered view of at-risk members with
    engagement scores

**5.4 Class & Schedule (4 screens)**

-   S12 --- Schedule Calendar: Weekly/monthly view with color-coded
    classes

-   S13 --- Class Detail: Roster, occupancy, trainer, check-in status

-   S14 --- Create/Edit Class: Full class creation form with recurrence
    settings

-   S15 --- Waitlist Manager: View and manage waitlisted members per
    class

**5.5 Financial Management (5 screens)**

-   S16 --- Financial Dashboard: Revenue vs Expense chart, P&L summary,
    collection rate

-   S17 --- Payments List: All transactions with filters (date, branch,
    method, status)

-   S18 --- Record Payment: Manual payment entry form

-   S19 --- Expense Tracker: Add expense, category view, monthly expense
    chart

-   S20 --- Invoice View/Download: Individual invoice with PDF export

**5.6 Trainer & Staff (3 screens)**

-   S21 --- Staff List: All staff with roles, branches, performance
    badge

-   S22 --- Staff Profile: Schedule, performance metrics, class history

-   S23 --- Add/Edit Staff: Profile creation, role assignment, branch
    linking

**5.7 Marketing (4 screens)**

-   S24 --- Marketing Dashboard: Active campaigns, trigger status,
    referral stats

-   S25 --- Campaign Creator: Segment selector, message composer,
    schedule, preview

-   S26 --- Automation Rules: Toggle and configure all automated
    triggers

-   S27 --- Referral Program: Code list, reward config, conversion
    tracker

**5.8 Settings & Configuration (3 screens)**

-   S28 --- Studio Settings: Name, logo, branches, timezone, currency,
    language

-   S29 --- Membership Plans: Create/edit/archive plans

-   S30 --- Integrations: Payment gateway config (Razorpay/Stripe), SMS
    provider, Email config

**Total: 30 screens across Web + iOS + Android**

**🔄 Section 6: Key User Flows**

**Flow 1: New Member Onboarding (Target: \< 3 minutes)**

6.  Owner/Staff opens Members → tap \"+ Add Member\"

7.  Enter: name, phone number (mandatory), email (optional), DOB

8.  Select membership plan from dropdown

9.  Select check-in method: QR / RFID (enter card number) / Manual

10. System generates member ID and QR code automatically

11. Record payment: amount, method, gateway (or cash)

12. Invoice auto-generated and sent to member via SMS/email

13. Member profile created and active --- shows on dashboard count

**Flow 2: Member Check-In (Target: \< 5 seconds)**

14. Front desk staff opens Check-In Screen (S10) on tablet

15. Member presents QR / taps RFID / camera detects face / staff
    searches name

16. System validates: Is membership active? Are classes remaining? Is
    this the correct branch?

17. Valid: Green \"Welcome, \[Name\]!\" confirmation shown + attendance
    logged

18. Invalid: Red error shown (Expired / No Credits / Wrong Branch) +
    auto-prompt to renew

19. Attendance data synced to dashboard in \< 5 seconds

**Flow 3: Membership Renewal (Auto-Renewal Path)**

20. System detects expiry in 3 days → triggers automated reminder (SMS +
    Email + Push)

21. If auto-renew ON: charges saved payment method on expiry date

22. Payment success: membership extended, invoice sent, dashboard count
    unchanged

23. Payment failure: owner alerted, member sent manual payment link,
    status set to \"Expiring\"

24. If auto-renew OFF: owner prompted in alert panel to manually renew
    or send payment link

**Flow 4: AI Advisor Query**

25. Owner taps floating AI Chat button (available on all screens)

26. Types: \"Which trainer had the best attendance rate this month?\"

27. AI queries real-time data, computes answer, responds in \< 3 seconds

28. Response shown with data summary + recommended action if applicable

29. Owner can follow-up with natural language (\"What about Branch 2
    specifically?\")

**Flow 5: Marketing Campaign**

30. Owner goes to Marketing → Create Campaign

31. Selects segment: \"Members expiring in next 14 days\"

32. Writes message using template variables: \"Hi {{member_name}}, your
    membership expires on {{expiry_date}}. Renew today for 10% off!\"

33. Selects channels: WhatsApp + Email

34. Schedules for 9 AM tomorrow or sends immediately

35. Campaign delivers; delivery report shows sent/delivered/failed
    counts

36. Owner views which members renewed post-campaign (conversion
    tracking)

**🔐 Section 7: Role-Based Access Control**

  ------------------- ------------ ------------- ------------- ------------
  **Module**          **Owner**    **Manager**   **Trainer**   **Front
                                                               Desk**

  Dashboard (all      ✅ Full      ✅ Own branch ❌            ❌
  branches)                                                    

  Member Management   ✅ Full      ✅ Full       👁 View only   ✅ Check-in
                                                               only

  Financial Data      ✅ Full      ✅ Own branch ❌            Record
                                                               payment

  Staff Management    ✅ Full      View only     ❌            ❌

  Class Scheduling    ✅ Full      ✅ Full       Own classes   View only

  Marketing Campaigns ✅ Full      ✅ Full       ❌            ❌

  AI Advisor          ✅ Full      Own branch    ❌            ❌

  Settings & Billing  ✅ Full      ❌            ❌            ❌
  ------------------- ------------ ------------- ------------- ------------

**📊 Section 8: Success Metrics**

**8.1 Business Metrics (Measured at 3 Months Post-Launch)**

  -------------------------- --------------- --------------- --------------
  **Metric**                 **Baseline**    **Target        **Priority**
                                             (3mo)**         

  Studios onboarded          0               50+             🔴 Critical

  Monthly Recurring Revenue  \$0             \$15,000+       🔴 Critical
  (MRR)                                                      

  Paid plan conversion rate  0%              \>40% from      🔴 Critical
                                             trial           

  Studio monthly churn rate  ---             \< 5%           🟡 High

  Owner-reported admin time  ---             \> 50%          🟡 High
  saved                                      reduction       
  -------------------------- --------------- --------------- --------------

**8.2 Product Metrics (Measured Continuously)**

  -------------------------- ---------------------- ----------------------
  **Metric**                 **Target**             **Measurement Method**

  Daily Active Users         \> 70% of active       Session analytics
  (owners)                   accounts               

  Check-in success rate      \> 98% (no errors)     Error log monitoring

  AI chat queries per week   \> 10 queries          AI usage logs
  per studio                                        

  Payment collection rate    \> 85% of renewals     Payment records
  via platform                                      

  Member retention           \> 20% vs pre-platform Owner survey at 90
  improvement                baseline               days

  Page load time (dashboard) \< 2 seconds (P95)     Performance monitoring

  App crash rate (mobile)    \< 0.1%                Crashlytics / Sentry
  -------------------------- ---------------------- ----------------------

**🚫 Section 9: Out of Scope (v1.0)**

> **Important:** The following items are explicitly excluded from v1.0
> to protect scope. They are documented here to prevent feature creep.

  -------------------------- -------------------------- -----------------
  **Feature**                **Reason Excluded**        **Planned Phase**

  Member-facing mobile app   Separate product track;    Phase 4
                             requires distinct UX       
                             design                     

  Member self-service portal Owner-first product;       Phase 3
  (web)                      member portal adds         
                             complexity                 

  E-commerce / merchandise   Out of core gym ops scope  Not planned
  store                                                 

  Video class streaming      Requires CDN and video     Not planned
                             infra; separate product    

  Payroll management         HR product --- out of      Phase 3 lite
                             scope for gym ops          

  Nutrition / diet tracking  Member wellness feature    Not planned
                             --- separate app concern   

  Custom mobile app          Enterprise-tier feature;   Phase 4
  white-labeling             requires separate builds   

  Third-party accounting     Deduplicated by built-in   Phase 3
  (Tally/QuickBooks)         finance module             

  Wearable device            Hardware partner           Phase 4
  integration                dependency; not core to    
                             gym ops                    
  -------------------------- -------------------------- -----------------

**🗓️ Section 10: Development Phases**

**Phase 1 --- Foundation (Months 1--2)**

> **Goal:** Core platform running with member management, check-in, and
> payments.

-   Authentication, role-based access, multi-branch setup

-   Member CRUD, membership plan management, member profiles

-   Manual check-in + QR code check-in

-   Cash and manual payment recording

-   Basic dashboard KPIs (4 cards + recent activity)

-   Web app (desktop) primary --- iOS and Android scaffolding

**Phase 2 --- Intelligence (Months 3--4)**

> **Goal:** AI advisor live, advanced check-in methods, online payments,
> automated comms.

-   RFID and facial recognition check-in

-   Razorpay and Stripe payment gateway integration

-   Auto-renewal logic and subscription billing

-   Invoice PDF generation and export

-   AI Business Advisor (Claude API integration with studio data
    context)

-   Automated communication triggers (SMS, Email, WhatsApp, Push)

-   Class scheduling and trainer assignment

-   iOS and Android apps --- full feature parity with web

**Phase 3 --- Growth (Months 5--6)**

> **Goal:** Marketing automation, analytics depth, expense tracking,
> trainer performance.

-   Campaign manager with segment targeting

-   Referral program with reward tracking

-   Churn risk scoring and retention intelligence

-   Expense tracking and P&L dashboard

-   Trainer performance analytics and comparison

-   Peak hours heatmap and advanced analytics

-   AI proactive alerts --- Daily Briefing and anomaly detection

-   Performance optimization, security audit, and launch readiness

**🔐 Section 11: Privacy & Safety**

**11.1 Data Security**

-   All data encrypted at rest (AES-256) and in transit (TLS 1.3)

-   Member biometric data (facial recognition templates) stored locally
    on device --- never sent to cloud

-   Payment credentials: Zero card data stored on MuscleX servers ---
    all handled by Razorpay/Stripe PCI-DSS vaults

-   Passwords: bcrypt hashed, minimum 8 characters, enforced strength
    policy

**11.2 Authentication**

-   JWT-based session tokens with 24-hour expiry for web, 30-day refresh
    for mobile

-   Multi-factor authentication (OTP via SMS) available for owner
    accounts

-   Max 5 failed login attempts → 15-minute lockout

**11.3 Data Compliance**

-   GDPR-ready: Data export and deletion (\"right to be forgotten\") for
    member records

-   Member data visible only to staff of the same branch (cross-branch
    data requires Manager/Owner role)

-   Audit logs: All data modifications logged with user, timestamp, and
    action

**11.4 Backup & Recovery**

-   Automated daily database backups --- 30-day retention

-   Point-in-time recovery: Restore to any state within the last 7 days

-   RPO (Recovery Point Objective): \< 1 hour \| RTO (Recovery Time
    Objective): \< 4 hours

**✅ Section 12: Definition of Done**

A feature is considered \"Done\" only when ALL of the following criteria
are met:

**12.1 Functional Criteria**

-   All acceptance criteria for the feature are met and tested

-   Feature works correctly on Web (Chrome, Safari, Firefox), iOS 15+,
    and Android 10+

-   Works offline for check-in (queues sync when connection restored)

-   Multi-branch isolation is enforced --- no cross-branch data leakage

**12.2 Performance Criteria**

-   Dashboard loads in \< 2 seconds on 4G connection

-   Check-in confirmation shown in \< 1 second after scan/tap

-   AI advisor responds in \< 3 seconds for standard queries

-   Mobile app binary size \< 50MB

**12.3 Quality Criteria**

-   Unit test coverage ≥ 70% for all business logic modules

-   Zero P1/P2 bugs open at release

-   UI tested against design system --- no rogue colors, fonts, or
    spacing

-   All user flows tested end-to-end on real devices (not just
    simulators)

**12.4 Security Criteria**

-   OWASP Top 10 vulnerabilities checked and resolved

-   API endpoints authenticated --- no unauthenticated data access

-   Penetration test passed before Phase 3 launch

**🎨 Section 13: Design System**

> **Design Philosophy:** Dark, bold, and modern with the serene
> precision of the Duomo color palette. Inspired by the soft sky blues
> and deep navy of the reference app --- applied with gym-grade
> confidence and clarity.

**13.1 Color Palette**

  ------------------------- ------------- --------------- -----------------------
  **Token Name**            **Hex Code**  **Swatch**      **Usage**

  \--color-bg-primary       #0D1B2A                       App background, nav bar

  \--color-bg-surface       #1A2F45                       Card backgrounds,
                                                          sidebars

  \--color-bg-card          #1E3450                       Elevated cards, modals

  \--color-accent-primary   #4A9FD4                       CTAs, active states,
                                                          links

  \--color-accent-light     #6BBFE8                       Hover states,
                                                          highlights

  \--color-text-primary     #FFFFFF                       Primary body text

  \--color-text-secondary   #B0C8E0                       Secondary text,
                                                          captions

  \--color-text-muted       #5A7A9A                       Placeholders, disabled

  \--color-success          #34C77A                       Success states, active
                                                          badges

  \--color-warning          #F59E0B                       Expiring soon, alerts

  \--color-danger           #EF4444                       Errors, expired, high
                                                          risk

  \--color-border           #2A4A6A                       Card borders, dividers
  ------------------------- ------------- --------------- -----------------------

**13.2 Typography**

  ------------------ ------------- ------------- ------------------------
  **Element**        **Font**      **Size /      **Usage**
                                   Weight**      

  Display / Hero     Inter         32px / 800    Page titles, KPI numbers

  Heading 1          Inter         24px / 700    Section headers

  Heading 2          Inter         18px / 600    Card titles, subsections

  Body Regular       Inter         14px / 400    Main content text

  Body Small         Inter         12px / 400    Captions, meta info

  Monospace (data)   JetBrains     13px / 400    Member IDs, codes,
                     Mono                        amounts
  ------------------ ------------- ------------- ------------------------

**13.3 Component Specifications**

**Buttons**

-   Primary: bg #4A9FD4, text white, border-radius 8px, padding 12px
    24px, hover bg #3A8FC4

-   Secondary: bg transparent, border 1.5px #4A9FD4, text #4A9FD4, same
    radius/padding

-   Danger: bg #EF4444, text white

-   Disabled: bg #2A4A6A, text #5A7A9A, cursor not-allowed

**Cards**

-   Background: #1E3450 \| Border: 1px solid #2A4A6A \| Border-radius:
    12px \| Padding: 20px

-   Box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3)

-   Hover state: border-color #4A9FD4, subtle glow

**Status Badges**

-   Active: bg #34C77A20, text #34C77A, border 1px #34C77A

-   Expiring: bg #F59E0B20, text #F59E0B, border 1px #F59E0B

-   Expired: bg #EF444420, text #EF4444, border 1px #EF4444

-   Frozen: bg #4A9FD420, text #4A9FD4, border 1px #4A9FD4

**Input Fields**

-   Background: #0D1B2A \| Border: 1px solid #2A4A6A \| Border-radius:
    8px \| Text: white

-   Focus: border-color #4A9FD4, box-shadow 0 0 0 3px rgba(74, 159, 212,
    0.2)

-   Label: #B0C8E0, 12px, above field with 4px gap

**13.4 Iconography & Motion**

-   Icon set: Lucide Icons (open source, consistent stroke style)

-   Icon size: 16px (inline), 20px (nav), 24px (feature icons), 32px
    (empty states)

-   Transitions: all 0.2s ease --- no jarring snaps

-   Loading states: Skeleton shimmer using gradient from #1A2F45 to
    #2A4A6A

-   Page transitions: Fade + slight upward slide (opacity 0→1,
    translateY 8px→0)

**⚙️ Section 14: Recommended Technology Stack**

**14.1 Frontend --- Web**

-   Framework: Next.js 14 (React) --- App Router for SEO + performance

-   Styling: Tailwind CSS + shadcn/ui component library

-   State management: Zustand (lightweight, performant)

-   Charts: Recharts for dashboards, react-big-calendar for scheduling

-   Real-time: Socket.io client for live check-in feeds

**14.2 Frontend --- Mobile (iOS & Android)**

-   Framework: React Native (Expo) --- single codebase for iOS + Android

-   Navigation: React Navigation v6

-   Camera/QR: expo-camera + expo-barcode-scanner

-   Push notifications: Expo Notifications + Firebase Cloud Messaging

-   Offline support: AsyncStorage + background sync queue

**14.3 Backend**

-   Runtime: Node.js (v20 LTS) with TypeScript

-   Framework: NestJS --- modular, enterprise-grade architecture

-   API: REST for CRUD operations + WebSocket gateway for real-time
    updates

-   Authentication: JWT + bcrypt, Passport.js strategy

-   Job queues: BullMQ (Redis-backed) for scheduled messages and renewal
    jobs

**14.4 Database**

-   Primary DB: PostgreSQL (via Supabase) --- relational, multi-tenant
    with row-level security

-   Cache: Redis (Upstash) --- session cache, real-time counters, rate
    limiting

-   File storage: Supabase Storage --- member photos, invoice PDFs,
    receipt attachments

**14.5 AI & Integrations**

-   AI Advisor: Anthropic Claude API (claude-sonnet-4-20250514) ---
    conversational + data queries

-   Payments: Razorpay SDK (India) + Stripe SDK (International)

-   SMS/WhatsApp: Twilio (SMS) + WhatsApp Business API via Twilio

-   Email: Resend.com (transactional) + React Email templates

-   Biometric/Facial: TensorFlow.js (face-api.js) --- on-device ML, no
    cloud upload

**14.6 Infrastructure**

-   Hosting: Vercel (web frontend) + Railway or Render (backend +
    workers)

-   Database: Supabase (managed PostgreSQL + auth + storage)

-   CDN: Cloudflare for static assets and DDoS protection

-   Monitoring: Sentry (errors) + Posthog (analytics) + Uptime Robot
    (availability)

-   CI/CD: GitHub Actions --- test → build → deploy on every merge to
    main

**END OF DOCUMENT**

MuscleX PRD v1.0 \| Built with 💪 for fitness studio owners
worldwide
