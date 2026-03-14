# FitSync Pro — Screen Map

This document maps every screenshot to its PRD Screen ID and the folder where it should be placed.
Claude Code should reference these screenshots as visual guides when building each page.

## How to Use
- Each module folder in `docs/screens/` contains the PNGs for that section
- The PRD Screen ID (S01-S30) maps to the PRD Section 5 screen inventory
- The "Backend References" column tells you which TRD sections to read for API/DB specs

---

## Auth Module (`docs/screens/auth/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Login.png | S01 | Login Screen | TRD 5.1, 6.1 |
| Onboarding_Setup.png | S02 | Onboarding / Studio Setup | TRD 5.2 |
| Forgot_Password.png | S03 | Forgot Password / Reset | TRD 5.1 |

## Dashboard Module (`docs/screens/dashboard/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Main_Dashboard.png | S04 | Main Dashboard (KPIs + chart + alerts + feed) | TRD 5.6 |
| Branch_Selector.png | S05 | Branch Comparison View | TRD 5.6 |
| AI_Morning_Briefing_Dashboard.png | S06 (partial) | AI Morning Briefing | TRD 5.7 (GET /ai/daily-briefing) |

## Members Module (`docs/screens/members/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Member_List.png | S07 | Member List (search, filter, sort, paginate) | TRD 5.3 (GET /members) |
| Member_Profile__Sarah_Connor.png | S08 | Member Profile | TRD 5.3 (GET /members/:id) |
| New_Member_Registration.png | S09 | Add/Edit Member | TRD 5.3 (POST /members) |
| Churn_Risk_List.png | S11 | Churn Risk List | TRD 5.3 (GET /members/churn-risk) |
| Membership_Plan_Management.png | S29 | Membership Plans CRUD | TRD 4.2 (membership_plans table) |
| Membership_Plan_Management1.png | S29 (variant) | Membership Plans (alternate view) | TRD 4.2 |

## Check-In Module (`docs/screens/checkins/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Front_Desk_Checkin.png | S10 | Front Desk Check-In Hub | TRD 5.4 |
| QR_Checkin_Interface.png | S10 (QR mode) | QR Code Scanner | TRD 5.4 (POST /check-ins) |
| Manual_Checkin_Flow.png | S10 (manual mode) | Manual Search Check-In | TRD 5.4 (POST /check-ins) |
| Facial_Recognition_Checkin.png | S10 (facial mode) | Face ID Check-In | TRD 5.4 (POST /check-ins/facial), 7.5 |

## Classes Module (`docs/screens/classes/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Weekly_Class_Schedule.png | S12 | Schedule Calendar (week view) | TRD 4.2 (classes table) |
| Class_Details__HIIT_Advanced_Training.png | S13 | Class Detail | TRD 4.2 (classes, class_enrollments) |
| Create_New_Class_Form.png | S14 | Create/Edit Class | TRD 4.2 (classes table) |
| Class_Roster_Management.png | S13/S15 | Class Roster + Waitlist | TRD 4.2 (class_enrollments) |

## Finance Module (`docs/screens/finance/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Financial_Analytics_Dashboard.png | S16 | Financial Dashboard | TRD 5.6 (GET /dashboard/revenue-chart) |
| Payments_Management_Table.png | S17 | Payments List | TRD 5.5 (GET /payments) |
| Record_New_Payment_Form.png | S18 | Record Payment | TRD 5.5 (POST /payments/cash) |
| Record_Expense_Form.png | S19 | Expense Tracker | TRD 4.2 (expenses table) |
| Invoice_Preview.png | S20 | Invoice View/Download | TRD 5.5 (GET /payments/:id/invoice) |

## Staff Module (`docs/screens/staff/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Staff_Management_Directory.png | S21 | Staff List | TRD 4.2 (staff table) |
| Staff_Profile__Alex_Rivera.png | S22 | Staff Profile | TRD 4.2 (staff table) |
| Add_Edit_Staff.png | S23 | Add/Edit Staff Form | TRD 4.2 (staff table) |
| Staff_Shift_Schedule.png | S22 (schedule tab) | Staff Shift Schedule | PRD 6.3 |
| Leave_Request_Management.png | S22 (extension) | Leave Requests | PRD 6.3 |
| Trainer_Analytics_Dashboard.png | S22 (analytics) | Trainer Performance | TRD 5.6 (GET /analytics/trainer-performance) |

## Marketing Module (`docs/screens/marketing/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Marketing_Campaign_Dashboard.png | S24 | Marketing Dashboard | TRD 4.2 (campaigns table) |
| Campaign_Creator.png | S25 | Campaign Creator | TRD 4.2 (campaigns table) |
| Marketing_Automation_Rules.png | S26 | Automation Rules | TRD 4.2 (notifications_log) |
| Message_Template_Editor.png | S25 (template) | Message Template Editor | PRD 7.2 |
| Referral_Program.png | S27 | Referral Program | PRD 7.3 |

## AI Module (`docs/screens/ai/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| AI_Business_Advisor_Chat.png | S06 | AI Chat Interface | TRD 5.7, 7.1-7.4 |
| AI_Morning_Briefing_Dashboard.png | S06 (briefing) | Morning Briefing | TRD 5.7 (GET /ai/daily-briefing), 7.4 |

## Settings Module (`docs/screens/settings/`)

| File Name | PRD Screen ID | Page | Backend References |
|-----------|--------------|------|-------------------|
| Studio_Settings.png | S28 | Studio Settings | TRD 5.2 (PATCH /studio) |
| Membership_Plan_Management.png | S29 | Membership Plans | TRD 4.2 (membership_plans) |
| Integrations_Settings.png | S30 | Integrations Config | PRD Section 14 |

---

## Notes for Claude Code

1. Several screens are MISSING and need to be created from PRD descriptions alone:
   - S01 (Login), S02 (Onboarding), S03 (Forgot Password)
   - S04 (Main Dashboard), S05 (Branch Selector), S07 (Member List)
   - S11 (Churn Risk), S23 (Add/Edit Staff), S25 (Campaign Creator)
   - S27 (Referral Program), S28 (Studio Settings)
   
2. For missing screens, follow:
   - The PRD section that describes the screen's content
   - The design system from PRD Section 13
   - The layout pattern from existing similar screens

3. Some screenshots show inconsistent branding — ALWAYS use "FitSync Pro"
