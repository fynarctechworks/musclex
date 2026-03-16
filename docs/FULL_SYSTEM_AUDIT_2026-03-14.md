# FitSync Pro — Full System Audit Report

**Date:** 2026-03-14  
**Auditor:** Principal Software Architect  
**Scope:** NestJS Backend · Prisma Database · Next.js Frontend · Multi-Tenant SaaS

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Phase 1 — Backend Capability Inventory](#2-phase-1--backend-capability-inventory)
3. [Phase 2 — Database Model Inventory](#3-phase-2--database-model-inventory)
4. [Phase 3 — Frontend Surface Inventory](#4-phase-3--frontend-surface-inventory)
5. [Phase 4 — Feature Gap Analysis](#5-phase-4--feature-gap-analysis)
6. [Phase 5 — Missing Screen Requirements](#6-phase-5--missing-screen-requirements)
7. [Phase 6 — Priority Development Roadmap](#7-phase-6--priority-development-roadmap)

---

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| Backend Modules | 16 |
| Backend Controllers | 33 |
| API Endpoints | ~398 |
| DTOs / Validation | 91 |
| Prisma Models | 108 |
| Prisma Enums | 0 (string-based) |
| Supabase Migrations | 12 |
| Frontend Pages | 47 |
| Frontend Components | 30+ |
| Zustand Stores | 3 |
| Custom Hooks | 5 |
| **Backend features exposed in UI** | **~40%** |
| **Backend features missing from UI** | **~60%** |

The backend is substantially more complete than the frontend. Approximately 60% of backend capabilities have no corresponding frontend page or partial implementations. The largest gaps are in: **Inventory/POS** (0% UI), **Analytics/Reports** (5% UI), **Organization/Multi-Branch Hierarchy** (0% UI), **Platform Admin** (0% UI), **Compliance** (0% UI), advanced **Classes/Scheduling** (20% UI), and advanced **Staff/Payroll** (15% UI).

---

## 2. Phase 1 — Backend Capability Inventory

### Module Summary

| # | Module | Controllers | Endpoints | Models Used | Purpose |
|---|--------|-------------|-----------|-------------|---------|
| 1 | Auth | 5 | 38 | UserIdentity, UserDevice, LoginHistory, UserSession, SsoProvider, ApiKey, Permission, UserRole | Authentication, sessions, SSO, API keys, RBAC seed |
| 2 | Members | 5 | 47 | Member, MemberProfile, MemberBodyStats, MemberNote, MemberTag, MemberTagAssignment, MemberDocument, MemberReferral, MemberMembership, MembershipPlan, MembershipFreeze, FamilyMembership, FamilyMember, CorporateAccount, CorporateMember, GlobalAccessPass | Member CRUD, profiles, health tracking, CRM, tags, documents, referrals, family & corporate plans |
| 3 | Check-ins | 1 | 5 | CheckIn, Member, MemberMembership, Branch | QR, manual, facial recognition, offline sync, heatmap |
| 4 | Payments | 5 | 32 | Payment, Refund, Expense, MemberInvoice, InvoiceItem, Discount, TaxRate, PaymentGatewayConfig, FinancialTransaction | Cash/gateway payments, refunds, invoices, discounts, tax, ledger, financial reports |
| 5 | Dashboard | 1 | 5 | (aggregate queries) | KPIs, revenue chart, activity feed, alerts, branch comparison |
| 6 | Classes | 4 | 30 | ClassTemplate, ClassSession, ClassBooking, ClassWaitlist, ClassAttendance, ClassRecurringRule, StudioRoom, TrainerAssignment, Class (legacy), ClassEnrollment (legacy) | Template-based scheduling, sessions, bookings, waitlist, attendance, recurring rules, rooms |
| 7 | Staff | 3 | 29 | Staff, StaffProfile, StaffAvailability, StaffAttendance, StaffShift, TrainerClient, TrainerSession, PayrollConfig, TrainerRevenue, PayrollRecord, TrainerPerformanceRecord, LeaveRequest | Staff CRUD, attendance, shifts, trainer clients, payroll, performance |
| 8 | Marketing | 3 | 28 | Campaign, CampaignAudience, Lead, LeadActivity, MessageTemplate, AutomationWorkflow, WorkflowAction, ReferralProgram, PushNotification | Campaigns, leads/CRM, automation workflows, templates, referrals, push notifications |
| 9 | AI | 1 | 3 | AiConversation | Chat advisor, daily briefing, conversation history |
| 10 | Branches | 1 | 7 | Branch, BranchSettings | Branch CRUD and settings |
| 11 | Settings | 1 | 6 | Studio, SubscriptionPlan | Studio config, account overview, plan management |
| 12 | Audit | 1 | 3 | AuditLog | Audit log viewer |
| 13 | Roles | 1 | 6 | Role, RolePermission, Permission | Custom role CRUD, permission matrix |
| 14 | Organization | 3 | 19 | Organization, OrganizationSettings, Region, FranchiseOwner, BranchFranchise | Multi-org hierarchy, regions, franchise management |
| 15 | Compliance | 1 | 8 | ConsentLog, DataRequest | GDPR consent, data export/deletion |
| 16 | Platform | 3 | 26 | FeatureFlag, WhiteLabelConfig, SsoProvider, SystemNotification, Integration, Webhook, WebhookDelivery | Feature flags, white-label, integrations, webhooks, notifications |
| 17 | Analytics | 2 | 18 | DailyGymMetrics, MembershipAnalytics, RevenueAnalytics, ClassAnalytics, MemberBehaviorAnalytics, TrainerAnalytics, CampaignAnalyticsRecord | Dashboard analytics, reports, exports |
| 18 | Search | 1 | 2 | (cross-model) | Global entity search, reindexing |
| 19 | Inventory | 3 | 27 | ProductCategory, Product, Inventory, InventoryTransaction, Supplier, PurchaseOrder, PurchaseOrderItem, PosSale, PosSaleItem, ProductReturn | Products, stock, suppliers, POs, POS sales, returns |

---

### Detailed Endpoint Listing

#### Auth Module (38 endpoints)

**AuthController** `/api/v1/auth`
- `POST /register` — Register new user (throttle: 5/min)
- `POST /verify-email` — Verify email with token
- `POST /resend-verification` — Resend verification (throttle: 3/min)
- `GET  /plans` — List subscription plans
- `POST /select-plan` — Select plan (JWT)
- `POST /setup-studio` — Complete studio setup (JWT)
- `POST /login` — Login with device tracking (throttle: 5/min)
- `POST /logout` — Revoke session
- `POST /refresh` — Refresh JWT
- `POST /forgot-password` — Initiate reset (throttle: 3/min)
- `POST /reset-password` — Complete reset
- `POST /select-workspace` — Multi-studio workspace select (JWT)

**AuthSessionController** `/api/v1/auth/sessions` (JWT)
- `GET  /` — Active sessions
- `POST /revoke` — Revoke session
- `POST /revoke-all` — Revoke all except current
- `GET  /devices` — Trusted devices
- `POST /devices/:id/trust` — Mark trusted
- `POST /devices/:id/untrust` — Remove trust
- `DELETE /devices/:id` — Delete device
- `GET  /history` — Login history
- `GET  /identity` — User identity

**AuthAdminController** `/api/v1/auth/admin` (JWT + owner)
- `GET  /login-history` — Filtered history
- `POST /users/:userId/suspend` — Suspend user
- `POST /users/:userId/reactivate` — Reactivate
- `POST /users/:userId/revoke-sessions` — Admin revoke

**AuthApiKeyController** `/api/v1/auth/api-keys` (JWT + owner)
- `GET  /` — List keys
- `GET  /:id` — Get key
- `POST /` — Create key
- `PATCH /:id` — Update key
- `POST /:id/deactivate` — Deactivate
- `POST /:id/reactivate` — Reactivate
- `DELETE /:id` — Delete key

**AuthSsoController** `/api/v1/auth/sso`
- `GET  /providers/active` — Active providers (JWT)
- `GET  /providers` — All providers (owner)
- `GET  /providers/:id` — Get provider (owner)
- `POST /providers` — Create provider (owner)
- `PATCH /providers/:id` — Update provider (owner)
- `DELETE /providers/:id` — Delete provider (owner)

#### Members Module (47 endpoints)

**MembersController** `/api/v1/members` (JWT + Permissions)
- `GET  /` — List members (status, branch, search, tag, trainer, churn_risk, page/limit)
- `GET  /churn-risk` — Churn risk breakdown
- `GET  /lifecycle` — Lifecycle summary
- `POST /` — Create member
- `GET  /:id` — Get member
- `PATCH /:id` — Update member
- `DELETE /:id` — Soft delete
- `POST /:id/freeze` — Freeze membership
- `POST /:id/unfreeze` — Unfreeze
- `POST /:id/renew` — Renew
- `POST /:id/face-descriptor` — Save face data
- `GET  /:id/profile` — Health profile
- `PATCH /:id/profile` — Upsert profile
- `GET  /:id/body-stats` — Body stats history
- `POST /:id/body-stats` — Create body stats
- `GET  /:id/progress` — Progress summary
- `GET  /:id/visits` — Visit stats
- `GET  /:id/notes` — CRM notes
- `POST /:id/notes` — Create note
- `DELETE /notes/:noteId` — Delete note
- `GET  /tags/all` — List tags
- `POST /tags` — Create tag
- `DELETE /tags/:tagId` — Delete tag
- `GET  /:id/tags` — Member tags
- `POST /:id/tags` — Assign tag
- `DELETE /:id/tags/:tagId` — Remove tag
- `GET  /:id/documents` — List documents
- `POST /:id/documents` — Upload document
- `DELETE /documents/:documentId` — Delete document
- `GET  /:id/referrals` — List referrals
- `POST /referrals` — Create referral
- `PATCH /referrals/:referralId` — Update referral

**MemberVisitsController** `/api/v1/members/:id` (JWT + Permissions)
- `GET  /:id/visit-history` — Visit history (date range, page/limit)
- `GET  /:id/visit-streak` — Streak info
- `GET  /:id/attendance-by-month` — Monthly attendance

**PlansController** `/api/v1/membership-plans` (JWT)
- `GET  /` — List plans (branch, org, type, active)
- `GET  /by-type/:planType` — By type
- `GET  /:id` — Get plan
- `POST /` — Create plan (owner)
- `PATCH /:id` — Update plan (owner)
- `DELETE /:id` — Delete plan (owner)

**MembershipsController** `/api/v1/memberships` (JWT)
- `POST /assign/:memberId` — Assign membership
- `GET  /member/:memberId` — Member memberships (status)
- `GET  /:id` — Get membership
- `POST /:id/freeze` — Freeze
- `POST /:id/unfreeze` — Unfreeze
- `POST /:id/cancel` — Cancel
- `POST /:id/renew` — Renew
- `PATCH /:id/auto-renew` — Toggle auto-renew
- `POST /:id/track-visit` — Track visit
- `GET  /stats/summary` — Stats (owner/manager)
- `POST /admin/run-expiry` — Manual expiry cron (owner)
- `POST /admin/run-auto-renew` — Manual auto-renew cron (owner)

**FamilyController** `/api/v1/family-memberships` (JWT)
- `POST /` — Create family
- `GET  /:id` — Get family
- `GET  /member/:memberId` — Family by member
- `POST /:id/members` — Add family member
- `DELETE /:id/members/:memberId` — Remove member

**CorporateController** `/api/v1/corporate` (JWT)
- `POST /accounts` — Create account (owner)
- `GET  /accounts` — List accounts
- `GET  /accounts/:id` — Get account
- `PATCH /accounts/:id` — Update (owner)
- `GET  /accounts/:id/members` — Account members
- `POST /accounts/:id/members` — Add member
- `DELETE /accounts/:id/members/:memberId` — Remove member

#### Check-ins Module (5 endpoints)

**CheckInsController** `/api/v1/check-ins` (JWT + Permissions)
- `POST /` — Create check-in (manual/QR)
- `POST /facial` — Facial recognition check-in
- `POST /sync` — Sync offline check-ins
- `GET  /` — List check-ins (branch, dates, member, page/limit)
- `GET  /heatmap` — 7×24 heatmap (weeks param)

#### Payments Module (32 endpoints)

**PaymentsController** `/api/v1/payments` (JWT + Permissions)
- `POST /cash` — Record manual payment
- `POST /create-order` — Create gateway order
- `POST /verify` — Verify gateway payment
- `GET  /` — List payments (branch, dates, status, page/limit)
- `GET  /:id/invoice` — Payment invoice

**RefundsController** `/api/v1/refunds` (JWT + Permissions)
- `POST /` — Process refund
- `GET  /` — List refunds
- `GET  /:id` — Get refund

**ExpensesController** `/api/v1/expenses` (JWT)
- `POST /` — Create expense
- `GET  /` — List expenses
- `PATCH /:id` — Update
- `DELETE /:id` — Delete

**InvoicesController** `/api/v1/invoices` (JWT + Permissions)
- `POST /` — Create invoice
- `GET  /` — List invoices
- `GET  /:id` — Get invoice
- `PATCH /:id/status` — Update status
- `POST /:id/cancel` — Cancel

**DiscountsController** `/api/v1/discounts|tax-rates|payment-gateways` (JWT + Permissions)
- `POST /discounts` — Create discount
- `GET  /discounts` — List discounts
- `GET  /discounts/validate/:code` — Validate code
- `GET  /discounts/:id` — Get discount
- `PATCH /discounts/:id` — Update
- `POST /tax-rates` — Create tax rate
- `GET  /tax-rates` — List
- `PATCH /tax-rates/:id` — Update
- `POST /payment-gateways` — Create config
- `GET  /payment-gateways` — List configs
- `PATCH /payment-gateways/:id` — Update

**FinancialReportsController** `/api/v1/financial-reports` (JWT + Permissions)
- `GET  /daily` — Daily revenue
- `GET  /monthly` — Monthly revenue
- `GET  /dashboard` — Dashboard metrics
- `GET  /membership-revenue` — Membership breakdown
- `GET  /ledger` — Financial ledger

#### Dashboard Module (5 endpoints)

**DashboardController** `/api/v1/dashboard` (JWT + Permissions)
- `GET  /kpis` — Key metrics
- `GET  /revenue-chart` — Revenue trend (12 months)
- `GET  /activity-feed` — Recent activity
- `GET  /alerts` — Alerts (inactivity, overdue, expiring)
- `GET  /branch-comparison` — Branch comparison

#### Classes Module (30 endpoints)

**ClassesController** `/api/v1/classes` (JWT + Permissions)
- `POST /` — Create class
- `GET  /` — List (branch, trainer, category, dates, status, page/limit)
- `GET  /:id` — Get class
- `PATCH /:id` — Update
- `POST /:id/enroll` — Enroll member
- `POST /:id/cancel-enrollment` — Cancel enrollment
- `POST /:id/promote-waitlist` — Promote from waitlist

**ClassTemplateController** `/api/v1/classes/templates` (JWT + Permissions)
- `POST /` — Create template
- `GET  /` — List templates
- `GET  /:id` — Get template
- `PATCH /:id` — Update
- `DELETE /:id` — Delete

**SessionController** `/api/v1/classes/sessions` (JWT + Permissions)
- `POST /` — Create session
- `GET  /` — List sessions (many filters)
- `GET  /:id` — Get session
- `PATCH /:id` — Update
- `POST /:id/cancel` — Cancel
- `GET  /trainer/:trainerId/schedule` — Trainer schedule
- `GET  /room/:studioId/schedule` — Room schedule
- `POST /rooms` — Create room
- `GET  /rooms` — List rooms
- `GET  /rooms/:id` — Get room
- `PATCH /rooms/:id` — Update room
- `POST /recurring-rules` — Create recurring rule
- `GET  /recurring-rules` — List rules
- `POST /recurring-rules/:id/deactivate` — Deactivate
- `POST /recurring-rules/generate` — Generate sessions

**BookingController** `/api/v1/classes/bookings` (JWT + Permissions)
- `POST /` — Book class
- `POST /:id/cancel` — Cancel booking
- `GET  /session/:sessionId` — Session bookings
- `GET  /member/:memberId` — Member bookings
- `GET  /waitlist/:sessionId/:memberId` — Waitlist position
- `DELETE /waitlist/:sessionId/:memberId` — Remove from waitlist
- `POST /attendance/:sessionId` — Mark attendance
- `POST /attendance/:sessionId/bulk` — Bulk attendance
- `GET  /attendance/:sessionId` — Session attendance
- `GET  /attendance/member/:memberId` — Member attendance history
- `POST /attendance/:sessionId/complete` — Complete session

#### Staff Module (29 endpoints)

**StaffController** `/api/v1/staff` (JWT + Roles + Permissions)
- `GET  /` — List staff (branch, role, status, search, page/limit)
- `GET  /:id` — Get staff
- `POST /` — Create staff
- `PATCH /:id` — Update
- `DELETE /:id` — Deactivate
- `GET  /:id/profile` — Profile
- `PATCH /:id/profile` — Update profile
- `GET  /:id/availability` — Availability
- `POST /:id/availability` — Set availability
- `GET  /:id/attendance` — Attendance (dates, branch)
- `POST /attendance/check-in` — Record check-in
- `PATCH /attendance/:id/check-out` — Record check-out
- `POST /shifts` — Create shift
- `GET  /shifts` — List shifts
- `PATCH /shifts/:id` — Update shift
- `DELETE /shifts/:id` — Delete shift

**TrainerController** `/api/v1/trainer` (JWT + Roles + Permissions)
- `POST /assign-client` — Assign member
- `GET  /:id/clients` — Trainer clients
- `PATCH /clients/:id` — Update assignment
- `POST /sessions` — Create PT session
- `GET  /sessions` — List sessions
- `PATCH /sessions/:id` — Update session
- `GET  /performance` — Trainer performance
- `GET  /:id/dashboard` — Trainer dashboard
- `POST /:id/performance-snapshot` — Record snapshot
- `GET  /:id/performance-history` — Performance history

**PayrollController** `/api/v1/payroll` (JWT + Roles + Permissions)
- `GET  /config/:staffId` — Payroll config
- `POST /config` — Upsert config
- `GET  /summary` — Payroll summary
- `POST /process` — Process payroll
- `GET  /records` — Payroll records
- `PATCH /records/:id` — Update record
- `GET  /revenue` — Trainer revenue

#### Marketing Module (28 endpoints)

**MarketingController** `/api/v1/campaigns` (JWT + Permissions)
- `GET  /` — List campaigns
- `POST /` — Create
- `GET  /:id` — Get
- `PATCH /:id` — Update
- `DELETE /:id` — Delete
- `POST /:id/send` — Send campaign
- `GET  /:id/audience` — Get audience
- `PATCH /:campaignId/audience/:memberId` — Update audience member
- `GET  /:id/analytics` — Campaign analytics

**LeadsController** `/api/v1/leads` (JWT + Roles + Permissions)
- `POST /` — Create lead
- `GET  /` — List leads (org, branch, status, source, assigned, search, page/limit)
- `GET  /funnel` — Funnel analytics
- `GET  /:id` — Get lead
- `PATCH /:id` — Update lead
- `POST /:id/activities` — Add activity
- `GET  /:id/activities` — Activities

**AutomationController** `/api/v1/message-templates|workflows|referral-programs|push-notifications`
- `POST /message-templates` — Create template
- `GET  /message-templates` — List
- `GET  /message-templates/:id` — Get
- `PATCH /message-templates/:id` — Update
- `DELETE /message-templates/:id` — Delete
- `POST /workflows` — Create workflow
- `GET  /workflows` — List
- `GET  /workflows/:id` — Get
- `PATCH /workflows/:id` — Update
- `POST /workflows/:id/actions` — Add action
- `DELETE /workflows/:workflowId/actions/:actionId` — Remove action
- `DELETE /workflows/:id` — Delete
- `POST /referral-programs` — Create
- `GET  /referral-programs` — List
- `GET  /referral-programs/stats` — Stats
- `GET  /referral-programs/:id` — Get
- `PATCH /referral-programs/:id` — Update
- `POST /push-notifications` — Send
- `GET  /push-notifications/:memberId` — Get

#### Organization Module (19 endpoints)

**OrganizationController** `/api/v1/organizations`
- `GET  /` — List organizations
- `GET  /:id` — Get
- `GET  /slug/:slug` — By slug
- `GET  /:id/hierarchy` — Hierarchy
- `POST /` — Create
- `PATCH /:id` — Update
- `GET  /:id/settings` — Settings
- `PATCH /:id/settings` — Update settings

**RegionController** `/api/v1/regions`
- `GET  /` — List regions
- `GET  /:id` — Get
- `POST /` — Create
- `PATCH /:id` — Update
- `DELETE /:id` — Deactivate

**FranchiseController** `/api/v1/franchise-owners`
- `GET  /` — List
- `GET  /:id` — Get
- `POST /` — Create
- `PATCH /:id` — Update
- `POST /branch-assignments` — Assign branch
- `DELETE /:franchiseOwnerId/branches/:branchId` — Unassign
- `GET  /:id/branches` — Owner branches

#### Analytics Module (18 endpoints)

**DashboardAnalyticsController** `/api/v1/analytics`
- `GET  /dashboard` — Dashboard summary
- `GET  /daily-metrics` — Daily metrics
- `GET  /daily-metrics/trend` — Trend
- `GET  /revenue` — Revenue analytics
- `GET  /memberships` — Membership analytics
- `GET  /classes` — Class analytics
- `GET  /members/behavior` — Member behavior
- `GET  /members/churn-risk` — Churn risk
- `GET  /trainers` — Trainer analytics
- `GET  /trainers/leaderboard` — Leaderboard
- `GET  /campaigns` — Campaign analytics
- `GET  /branch-comparison` — Branch comparison

**ReportsController** `/api/v1/reports`
- `GET  /export` — Export report (type, format)
- `GET  /revenue` — Revenue report
- `GET  /membership` — Membership report
- `GET  /attendance` — Attendance report
- `GET  /trainers` — Trainer report
- `GET  /inventory` — Inventory report

#### Inventory Module (27 endpoints)

**ProductsController** `/api/v1/products|product-categories|inventory`
- `POST /product-categories` — Create category
- `GET  /product-categories` — List
- `PATCH /product-categories/:id` — Update
- `POST /products` — Create product
- `GET  /products` — List (branch, org, category, status, search, page/limit)
- `GET  /products/barcode/:barcode` — By barcode
- `GET  /products/sku/:sku` — By SKU
- `GET  /products/:id` — Get
- `PATCH /products/:id` — Update
- `GET  /inventory` — Stock levels (branch, low_stock, page/limit)
- `POST /inventory/adjust` — Adjust stock
- `PATCH /inventory/:productId/reorder-level` — Update reorder
- `GET  /inventory/transactions` — Transactions
- `GET  /inventory/low-stock` — Low stock alerts

**SuppliersController** `/api/v1/suppliers|purchase-orders`
- `POST /suppliers` — Create supplier
- `GET  /suppliers` — List
- `GET  /suppliers/:id` — Get
- `PATCH /suppliers/:id` — Update
- `POST /purchase-orders` — Create PO
- `GET  /purchase-orders` — List
- `GET  /purchase-orders/:id` — Get
- `POST /purchase-orders/:id/receive` — Receive PO
- `PATCH /purchase-orders/:id/cancel` — Cancel PO

**PosController** `/api/v1/pos`
- `POST /sales` — Create sale
- `GET  /sales` — List sales
- `GET  /sales/daily-report` — Daily report
- `GET  /sales/top-products` — Top products
- `GET  /sales/:id` — Get sale
- `POST /returns` — Process return

#### Remaining Modules

**Compliance** `/api/v1/compliance` (8 endpoints)
- Consent recording, retrieval, history
- Data export/deletion requests
- Retention policy management

**Platform** `/api/v1/platform|integrations|webhooks` (26 endpoints)
- Feature flags CRUD + bulk toggle
- White-label config
- SSO providers
- System notifications + unread count
- Integration catalog, CRUD, testing
- Webhook CRUD, delivery history, retry

**Search** `/api/v1/search` (2 endpoints)
- Global search (q, entities, limit, branch_id)
- Reindex by index name

**Audit** `/api/v1/audit` (3 endpoints)
- Recent logs, by module, by user

**Roles** `/api/v1/roles` (6 endpoints)
- CRUD + permission modules list

**Settings** `/api/v1/settings` (6 endpoints)
- Studio settings, account overview, invoices, branch summary, plans

---

## 3. Phase 2 — Database Model Inventory

### 108 Models grouped by domain

#### Auth (10 models)
| Model | Purpose |
|-------|---------|
| UserIdentity | Global user authentication record |
| UserDevice | Device fingerprinting & trusted device tracking |
| LoginHistory | Login audit trail (IP, user agent, status) |
| UserSession | Active JWT sessions with refresh tokens |
| EmailVerification | Email verification tokens |
| PendingRegistration | Temporary pre-verified signups |
| Permission | RBAC permission definitions (module.action) |
| UserRole | User-to-role assignments per studio |
| SsoProvider | SSO configuration (Google, SAML, etc.) |
| ApiKey | API key credentials with scopes |

#### Organization (6 models)
| Model | Purpose |
|-------|---------|
| Organization | Root multi-tenant organization entity |
| OrganizationSettings | Org-level configuration & branding |
| Region | Geographic region grouping |
| Branch | Physical gym location |
| BranchSettings | Per-branch rules & policies |
| FranchiseOwner + BranchFranchise | Franchise owner management |

#### Members (16 models)
| Model | Purpose |
|-------|---------|
| Member | Core member profile (name, phone, email, status, qr_code, face_descriptor) |
| MemberProfile | Extended profile (height, weight goals, medical conditions, fitness goals) |
| MemberBodyStats | Fitness measurements history (weight, body fat%, BMI) |
| MemberNote | Staff CRM notes on member (pinned, categories) |
| MemberTag + MemberTagAssignment | Tagging system for member segmentation |
| MemberDocument | Document uploads (waivers, ID copies, medical certificates) |
| MemberReferral | Referral tracking between members |
| MembershipPlan | Plan templates (monthly, quarterly, yearly, class-pack, pay-per-visit) |
| MemberMembership | Active subscription linking member → plan → branch |
| MembershipFreeze | Freeze request history |
| FamilyMembership + FamilyMember | Family plan grouping |
| CorporateAccount + CorporateMember | Corporate bulk memberships |
| GlobalAccessPass | Multi-branch access passes |

#### Check-ins (1 model)
| Model | Purpose |
|-------|---------|
| CheckIn | Check-in record (method, status, failure_reason, class linkage) |

#### Classes & Scheduling (10 models)
| Model | Purpose |
|-------|---------|
| ClassTemplate | Class type definition (name, category, default capacity/duration) |
| ClassSession | Individual scheduled instance of a template |
| ClassBooking | Member booking for a session |
| ClassWaitlist | Waitlist entries with position tracking |
| ClassAttendance | Attendance mark (present/absent/late/excused) |
| ClassRecurringRule | Recurring schedule rules |
| StudioRoom | Physical room/studio definitions |
| TrainerAssignment | Trainer-session assignments |
| Class (legacy) | Older class model for backward compat |
| ClassEnrollment (legacy) | Older enrollment model |

#### Staff & Payroll (13 models)
| Model | Purpose |
|-------|---------|
| Role + RolePermission | Custom role definitions with permission matrix |
| Staff | Employee record (role, branches, specializations, salary) |
| StaffProfile | Extended profile (bio, certifications, rating) |
| StaffAvailability | Weekly availability schedule |
| StaffAttendance | Staff check-in/out records |
| StaffShift | Shift assignments |
| LeaveRequest | Leave request tracking |
| TrainerClient | Trainer-member assignment |
| TrainerSession | Personal training sessions |
| PayrollConfig | Payroll calculation config per staff |
| PayrollRecord | Processed payroll periods |
| TrainerRevenue | Revenue tracking per trainer |
| TrainerPerformanceRecord | Trainer KPI snapshots |

#### Payments & Billing (11 models)
| Model | Purpose |
|-------|---------|
| Payment | Member payment record (amount, method, status, gateway ref) |
| MemberInvoice + InvoiceItem | Invoice generation with line items |
| Refund | Refund processing with audit trail |
| Discount | Coupon/discount codes |
| TaxRate | Tax rate configuration by region |
| PaymentGatewayConfig | Razorpay/Stripe gateway credentials |
| FinancialTransaction | Double-entry financial ledger |
| PaymentRetryLog | Failed payment retry tracking |
| Expense | Studio operational expenses |

#### Marketing & Automation (8 models)
| Model | Purpose |
|-------|---------|
| Lead + LeadActivity | Sales lead/prospect with activity trail |
| Campaign + CampaignAudience | Marketing campaign with audience targeting |
| MessageTemplate | SMS/email/WhatsApp message templates |
| AutomationWorkflow + WorkflowAction | Trigger-action automation rules |
| ReferralProgram | Member referral program configuration |

#### Inventory & POS (10 models)
| Model | Purpose |
|-------|---------|
| ProductCategory | Product taxonomy |
| Product | Product/service SKU (barcode, pricing, images) |
| Inventory | Stock levels per product per branch |
| InventoryTransaction | Stock movement ledger |
| Supplier | Vendor management |
| PurchaseOrder + PurchaseOrderItem | Purchase order with line items |
| PosSale + PosSaleItem | Point-of-sale transactions |
| ProductReturn | Product return processing |

#### Analytics (7 models)
| Model | Purpose |
|-------|---------|
| DailyGymMetrics | Daily aggregated snapshot (revenue, visits, signups, churn) |
| MembershipAnalytics | Membership KPIs per plan |
| RevenueAnalytics | Revenue breakdown by type |
| ClassAnalytics | Class performance metrics |
| MemberBehaviorAnalytics | Engagement scoring and churn prediction |
| TrainerAnalytics | Trainer performance aggregation |
| CampaignAnalyticsRecord | Campaign performance metrics |

#### AI (1 model)
| Model | Purpose |
|-------|---------|
| AiConversation | AI advisor chat history |

#### Audit & Compliance (3 models)
| Model | Purpose |
|-------|---------|
| AuditLog | Action audit trail |
| ConsentLog | GDPR consent records |
| DataRequest | Data export/deletion requests |

#### Notifications (3 models)
| Model | Purpose |
|-------|---------|
| NotificationLog | Delivery tracking (SMS, email, WhatsApp) |
| PushNotification | Push notification records |
| SystemNotification | System-wide alerts |

#### Platform & Integrations (5 models)
| Model | Purpose |
|-------|---------|
| FeatureFlag | Feature toggle management |
| WhiteLabelConfig | White-label branding |
| Integration | Third-party service connections |
| Webhook + WebhookDelivery | Webhook configuration and delivery history |

---

## 4. Phase 3 — Frontend Surface Inventory

### 47 Pages

#### Public Pages (12)
| Route | Purpose | APIs Called |
|-------|---------|-----------|
| `/` | Landing page | — |
| `/login` | Login | `POST /auth/login` |
| `/register` | Registration | `POST /auth/register` |
| `/forgot-password` | Password reset request | `POST /auth/forgot-password` |
| `/reset-password` | New password form | `POST /auth/reset-password` |
| `/verify-email` | Email verification | `POST /auth/verify-email`, `POST /auth/resend-verification` |
| `/onboarding` | Redirect to register | — |
| `/onboarding/verify` | Redirect to verify-email | — |
| `/onboarding/plans` | Plan selection | `GET /auth/plans`, `POST /auth/select-plan` |
| `/onboarding/setup` | Studio creation | `POST /auth/setup-studio` |
| `/workspace-select` | Workspace selector | `POST /auth/select-workspace` |
| `/auth/callback` | OAuth callback | Supabase |

#### Protected Pages (35)
| Route | Purpose | APIs Called |
|-------|---------|-----------|
| `/[gym]/dashboard` | KPIs + charts | `/dashboard/kpis`, `/dashboard/revenue-chart`, `/dashboard/activity-feed`, `/dashboard/alerts`, `/branches` |
| `/[gym]/dashboard/branches` | Branch comparison | `/dashboard/branch-comparison` |
| `/[gym]/members` | Member list + filters | `/members`, `/branches` |
| `/[gym]/members/new` | Add member | `/membership-plans`, `/branches`, `POST /members` |
| `/[gym]/members/[id]` | Member detail (tabs) | `/members/:id`, `/membership-plans` |
| `/[gym]/members/[id]/edit` | Edit member | `/members/:id`, `PATCH /members/:id` |
| `/[gym]/members/churn-risk` | Churn risk table | `/members?churn_risk` |
| `/[gym]/check-in` | Check-in hub | `/check-ins?limit=10` |
| `/[gym]/check-in/qr` | QR scanner | `POST /check-ins` |
| `/[gym]/check-in/manual` | Manual check-in | `/members?search`, `POST /check-ins` |
| `/[gym]/check-in/facial` | Facial (placeholder) | — |
| `/[gym]/check-in/history` | Check-in history | `/check-ins` |
| `/[gym]/schedule` | Weekly calendar | `/classes` |
| `/[gym]/classes/new` | Create class | `/staff?role=trainer`, `/branches`, `POST /classes` |
| `/[gym]/classes/[id]` | Class detail | `/classes/:id`, enroll/cancel |
| `/[gym]/finance` | Finance overview | `/payments?limit=50`, `/expenses` |
| `/[gym]/finance/payments` | Payments table | `/payments` |
| `/[gym]/finance/payments/new` | Record payment | `/members?search`, `/membership-plans`, `POST /payments/cash` |
| `/[gym]/finance/expenses/new` | Add expense | `POST /expenses` |
| `/[gym]/staff` | Staff directory | `/staff`, `/branches` |
| `/[gym]/staff/new` | Add staff | `/branches`, `POST /staff` |
| `/[gym]/staff/[id]` | Staff profile | `/staff/:id` |
| `/[gym]/staff/analytics` | Trainer performance | `/analytics/trainer-performance` |
| `/[gym]/marketing` | Campaigns list | `/campaigns` |
| `/[gym]/marketing/campaigns/new` | Create campaign | `POST /campaigns` |
| `/[gym]/marketing/automation` | Automation rules | `PATCH /campaigns/automation/:ruleId` |
| `/[gym]/settings` | Settings hub | `/settings/account`, `/settings/studio` |
| `/[gym]/settings/account` | Account settings | `/settings/studio`, `/settings/account` |
| `/[gym]/settings/subscription` | Subscription info | `/settings/account` |
| `/[gym]/settings/plans` | Plan management | `/membership-plans` |
| `/[gym]/settings/roles` | Role management | `/roles` |
| `/[gym]/settings/integrations` | Integrations (UI only) | — |
| `/[gym]/ai` | AI chat | `POST /ai/chat` |
| `/[gym]/ai/briefing` | Daily briefing | `GET /ai/daily-briefing` |
| `/[gym]/branches` | Branch management | `/branches` |

### Components: 30+ shared, 15 shadcn/ui
### Stores: auth-store, ui-store, workspace-store
### Hooks: useAuth, usePermissions, useWorkspace, useGymSlug

---

## 5. Phase 4 — Feature Gap Analysis

### Legend
- ✅ = Fully implemented in frontend
- ⚠️ = Partially implemented
- ❌ = No frontend implementation

### Auth & Sessions

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Login | `POST /auth/login` | `/login` | ✅ |
| Register | `POST /auth/register` | `/register` | ✅ |
| Email verification | `POST /auth/verify-email` | `/verify-email` | ✅ |
| Password reset | `POST /auth/forgot-password` + `/reset-password` | Both pages | ✅ |
| Plan selection | `POST /auth/select-plan` | `/onboarding/plans` | ✅ |
| Studio setup | `POST /auth/setup-studio` | `/onboarding/setup` | ✅ |
| Workspace select | `POST /auth/select-workspace` | `/workspace-select` | ✅ |
| Session management | `GET/POST /auth/sessions/*` | — | ❌ Missing |
| Device management | `GET/POST/DELETE /auth/sessions/devices/*` | — | ❌ Missing |
| Login history | `GET /auth/sessions/history` | — | ❌ Missing |
| User suspension | `POST /auth/admin/users/:id/suspend` | — | ❌ Missing |
| API key management | `CRUD /auth/api-keys` | — | ❌ Missing |
| SSO provider config | `CRUD /auth/sso/providers` | — | ❌ Missing |

### Members

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Member list | `GET /members` | `/members` | ✅ |
| Create member | `POST /members` | `/members/new` | ✅ |
| Member detail | `GET /members/:id` | `/members/[id]` | ✅ |
| Edit member | `PATCH /members/:id` | `/members/[id]/edit` | ✅ |
| Churn risk view | `GET /members/churn-risk` | `/members/churn-risk` | ✅ |
| Freeze/unfreeze | `POST /members/:id/freeze` | `/members/[id]` | ✅ |
| Renew membership | `POST /members/:id/renew` | `/members/[id]` | ✅ |
| Lifecycle summary | `GET /members/lifecycle` | — | ❌ Missing |
| Health profile | `GET/PATCH /members/:id/profile` | — | ❌ Missing |
| Body stats tracking | `GET/POST /members/:id/body-stats` | — | ❌ Missing |
| Progress summary | `GET /members/:id/progress` | — | ❌ Missing |
| Visit history | `GET /members/:id/visit-history` | — | ❌ Missing |
| Visit streak | `GET /members/:id/visit-streak` | — | ❌ Missing |
| Monthly attendance | `GET /members/:id/attendance-by-month` | — | ❌ Missing |
| CRM notes | `GET/POST /members/:id/notes` | `/members/[id]` | ⚠️ Notes modal exists |
| Tags | `CRUD /members/tags + /:id/tags` | — | ❌ Missing |
| Documents | `CRUD /members/:id/documents` | — | ❌ Missing |
| Referrals | `CRUD /members/:id/referrals` | — | ❌ Missing |
| Face descriptor | `POST /members/:id/face-descriptor` | — | ❌ Missing |
| Membership assign | `POST /memberships/assign/:memberId` | — | ❌ Missing (uses /members/:id/renew) |
| Membership stats | `GET /memberships/stats/summary` | — | ❌ Missing |
| Family memberships | `CRUD /family-memberships` | — | ❌ Missing |
| Corporate accounts | `CRUD /corporate/accounts` | — | ❌ Missing |

### Check-ins

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Manual check-in | `POST /check-ins` | `/check-in/manual` | ✅ |
| QR check-in | `POST /check-ins` | `/check-in/qr` | ✅ |
| Facial check-in | `POST /check-ins/facial` | `/check-in/facial` | ⚠️ Placeholder |
| Check-in history | `GET /check-ins` | `/check-in/history` | ✅ |
| Offline sync | `POST /check-ins/sync` | — | ❌ Missing |
| Heatmap | `GET /check-ins/heatmap` | — | ❌ Missing |

### Payments & Finance

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Record cash payment | `POST /payments/cash` | `/finance/payments/new` | ✅ |
| Payment list | `GET /payments` | `/finance/payments` | ✅ |
| Finance overview | Dashboard metrics | `/finance` | ✅ |
| Add expense | `POST /expenses` | `/finance/expenses/new` | ✅ |
| Gateway payments | `POST /payments/create-order` + `/verify` | — | ❌ Missing |
| Refund processing | `CRUD /refunds` | — | ❌ Missing |
| Invoice management | `CRUD /invoices` | — | ❌ Missing |
| Discount codes | `CRUD /discounts` | — | ❌ Missing |
| Tax rates | `CRUD /tax-rates` | — | ❌ Missing |
| Gateway config | `CRUD /payment-gateways` | — | ❌ Missing |
| Financial reports | `GET /financial-reports/*` | — | ❌ Missing |
| Financial ledger | `GET /financial-reports/ledger` | — | ❌ Missing |
| Expense list | `GET /expenses` | `/finance` (inline) | ⚠️ Partial |

### Dashboard

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| KPIs | `GET /dashboard/kpis` | `/dashboard` | ✅ |
| Revenue chart | `GET /dashboard/revenue-chart` | `/dashboard` | ✅ |
| Activity feed | `GET /dashboard/activity-feed` | `/dashboard` | ✅ |
| Alerts | `GET /dashboard/alerts` | `/dashboard` | ✅ |
| Branch comparison | `GET /dashboard/branch-comparison` | `/dashboard/branches` | ✅ |

### Classes & Scheduling

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Class list (calendar) | `GET /classes` | `/schedule` | ✅ |
| Create class | `POST /classes` | `/classes/new` | ✅ |
| Class detail | `GET /classes/:id` | `/classes/[id]` | ✅ |
| Enroll member | `POST /classes/:id/enroll` | `/classes/[id]` | ✅ |
| Class templates | `CRUD /classes/templates` | — | ❌ Missing |
| Session scheduling | `CRUD /classes/sessions` | — | ❌ Missing |
| Room management | `CRUD /classes/sessions/rooms` | — | ❌ Missing |
| Recurring rules | `CRUD /classes/sessions/recurring-rules` | — | ❌ Missing |
| Bookings | `CRUD /classes/bookings` | — | ❌ Missing |
| Attendance tracking | `POST /classes/bookings/attendance/*` | — | ❌ Missing |
| Trainer schedule | `GET /classes/sessions/trainer/:id/schedule` | — | ❌ Missing |
| Room schedule | `GET /classes/sessions/room/:id/schedule` | — | ❌ Missing |
| Waitlist management | `GET/DELETE /classes/bookings/waitlist/*` | — | ❌ Missing |

### Staff

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Staff list | `GET /staff` | `/staff` | ✅ |
| Create staff | `POST /staff` | `/staff/new` | ✅ |
| Staff profile | `GET /staff/:id` | `/staff/[id]` | ✅ |
| Trainer analytics | `GET /analytics/trainer-performance` | `/staff/analytics` | ✅ |
| Staff profile CRUD | `GET/PATCH /staff/:id/profile` | — | ❌ Missing |
| Availability | `GET/POST /staff/:id/availability` | — | ❌ Missing |
| Staff attendance | `GET /staff/:id/attendance` | — | ❌ Missing |
| Staff check-in/out | `POST /staff/attendance/check-in` | — | ❌ Missing |
| Shift management | `CRUD /staff/shifts` | — | ❌ Missing |
| Leave requests | — | — | ❌ Missing (model exists) |
| Trainer clients | `GET/POST /trainer/:id/clients` | — | ❌ Missing |
| PT sessions | `CRUD /trainer/sessions` | — | ❌ Missing |
| Trainer dashboard | `GET /trainer/:id/dashboard` | — | ❌ Missing |
| Payroll config | `GET/POST /payroll/config` | — | ❌ Missing |
| Process payroll | `POST /payroll/process` | — | ❌ Missing |
| Payroll records | `GET /payroll/records` | — | ❌ Missing |
| Trainer revenue | `GET /payroll/revenue` | — | ❌ Missing |

### Marketing

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Campaign list | `GET /campaigns` | `/marketing` | ✅ |
| Create campaign | `POST /campaigns` | `/marketing/campaigns/new` | ✅ |
| Automation rules | `PATCH /campaigns/automation` | `/marketing/automation` | ⚠️ Toggle only |
| Send campaign | `POST /campaigns/:id/send` | — | ❌ Missing |
| Campaign analytics | `GET /campaigns/:id/analytics` | — | ❌ Missing |
| Campaign audience | `GET /campaigns/:id/audience` | — | ❌ Missing |
| Lead management | `CRUD /leads` | — | ❌ Missing |
| Lead funnel | `GET /leads/funnel` | — | ❌ Missing |
| Lead activities | `CRUD /leads/:id/activities` | — | ❌ Missing |
| Message templates | `CRUD /message-templates` | — | ❌ Missing |
| Automation workflows | `CRUD /workflows` | — | ❌ Missing |
| Referral programs | `CRUD /referral-programs` | — | ❌ Missing |
| Push notifications | `POST /push-notifications` | — | ❌ Missing |

### AI Advisor

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Chat | `POST /ai/chat` | `/ai` | ✅ |
| Daily briefing | `GET /ai/daily-briefing` | `/ai/briefing` | ✅ |
| Conversation history | `GET /ai/conversations` | — | ❌ Missing |

### Analytics & Reports

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Dashboard analytics | `GET /analytics/dashboard` | — | ❌ Missing |
| Daily metrics | `GET /analytics/daily-metrics` | — | ❌ Missing |
| Revenue analytics | `GET /analytics/revenue` | — | ❌ Missing |
| Membership analytics | `GET /analytics/memberships` | — | ❌ Missing |
| Class analytics | `GET /analytics/classes` | — | ❌ Missing |
| Member behavior | `GET /analytics/members/behavior` | — | ❌ Missing |
| Churn risk analytics | `GET /analytics/members/churn-risk` | — | ❌ Missing |
| Trainer analytics | `GET /analytics/trainers` | `/staff/analytics` | ⚠️ Partial (bar chart only) |
| Trainer leaderboard | `GET /analytics/trainers/leaderboard` | — | ❌ Missing |
| Campaign analytics | `GET /analytics/campaigns` | — | ❌ Missing |
| Branch comparison | `GET /analytics/branch-comparison` | — | ❌ Missing |
| Revenue report | `GET /reports/revenue` | — | ❌ Missing |
| Membership report | `GET /reports/membership` | — | ❌ Missing |
| Attendance report | `GET /reports/attendance` | — | ❌ Missing |
| Trainer report | `GET /reports/trainers` | — | ❌ Missing |
| Inventory report | `GET /reports/inventory` | — | ❌ Missing |
| Report export | `GET /reports/export` | — | ❌ Missing |

### Inventory & POS (Entire module missing)

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Product categories | `CRUD /product-categories` | — | ❌ Missing |
| Products | `CRUD /products` | — | ❌ Missing |
| Inventory levels | `GET /inventory` | — | ❌ Missing |
| Stock adjustment | `POST /inventory/adjust` | — | ❌ Missing |
| Low stock alerts | `GET /inventory/low-stock` | — | ❌ Missing |
| Inventory transactions | `GET /inventory/transactions` | — | ❌ Missing |
| Suppliers | `CRUD /suppliers` | — | ❌ Missing |
| Purchase orders | `CRUD /purchase-orders` | — | ❌ Missing |
| POS sales | `CRUD /pos/sales` | — | ❌ Missing |
| Product returns | `POST /pos/returns` | — | ❌ Missing |
| Daily POS report | `GET /pos/sales/daily-report` | — | ❌ Missing |

### Organization (Entire module missing)

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Organization CRUD | `CRUD /organizations` | — | ❌ Missing |
| Org hierarchy | `GET /organizations/:id/hierarchy` | — | ❌ Missing |
| Org settings | `GET/PATCH /organizations/:id/settings` | — | ❌ Missing |
| Regions | `CRUD /regions` | — | ❌ Missing |
| Franchise owners | `CRUD /franchise-owners` | — | ❌ Missing |

### Compliance (Entire module missing)

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Consent management | `POST/GET /compliance/consents` | — | ❌ Missing |
| Data export | `POST /compliance/data-export` | — | ❌ Missing |
| Data deletion | `POST /compliance/data-deletion` | — | ❌ Missing |
| Retention policy | `GET /compliance/retention-policy` | — | ❌ Missing |

### Platform Admin (Entire module missing)

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Feature flags | `CRUD /platform/feature-flags` | — | ❌ Missing |
| White-label config | `GET/PATCH /platform/white-label` | — | ❌ Missing |
| System notifications | `CRUD /platform/notifications` | — | ❌ Missing |
| Integration catalog | `CRUD /integrations` | `/settings/integrations` | ⚠️ Read-only cards |
| Webhook management | `CRUD /webhooks` | — | ❌ Missing |

### Settings

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Studio settings | `GET/PATCH /settings/studio` | `/settings/account` | ✅ |
| Account overview | `GET /settings/account` | `/settings` | ✅ |
| Subscription info | `GET /settings/account` | `/settings/subscription` | ✅ |
| Plan management | `CRUD /membership-plans` | `/settings/plans` | ✅ |
| Role management | `CRUD /roles` | `/settings/roles` | ✅ |
| Billing invoices | `GET /settings/invoices` | `/settings/subscription` | ⚠️ Table present but API may not be called |
| Branch summary | `GET /settings/branches-summary` | — | ❌ Missing |

### Global Search

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Global search | `GET /search` | CommandPalette | ⚠️ Local links only, no API search |

### Audit

| Backend Feature | API Endpoint | Frontend Page | Status |
|----------------|-------------|---------------|--------|
| Audit log viewer | `GET /audit` | — | ❌ Missing |
| Audit by module | `GET /audit/by-module` | — | ❌ Missing |
| Audit by user | `GET /audit/by-user` | — | ❌ Missing |

---

## 6. Phase 5 — Missing Screen Requirements

### Dashboard Module

**Screen: Analytics Dashboard** (NEW)
- Purpose: Deep-dive analytics beyond basic KPIs
- Data: Revenue trends, membership funnels, class utilization, member behavior
- APIs: `GET /analytics/dashboard`, `/analytics/revenue`, `/analytics/memberships`, `/analytics/classes`, `/analytics/members/behavior`
- Components: Recharts line/bar/pie, date range picker, metric cards, filter by branch

### Members Module

**Screen: Member Health Profile** (NEW)
- Purpose: View/edit extended profile, body stats, progress
- Data: Height, weight, body fat%, BMI, goals, medical
- APIs: `GET/PATCH /members/:id/profile`, `GET/POST /members/:id/body-stats`, `GET /members/:id/progress`
- Components: Profile form, line chart for body stats trend, progress cards

**Screen: Member Visit Analytics** (NEW)
- Purpose: Visit history, streaks, monthly attendance patterns
- Data: Visit history, current streak, monthly breakdown
- APIs: `GET /members/:id/visit-history`, `/visit-streak`, `/attendance-by-month`
- Components: Calendar heatmap, streak counter, monthly bar chart, DataTable

**Screen: Member Tags Management** (NEW)
- Purpose: Create/manage tags, assign to members for segmentation
- Data: Tag list, assignment counts
- APIs: `CRUD /members/tags/all`, `POST/DELETE /members/:id/tags`
- Components: Tag chips, create dialog, bulk assign

**Screen: Member Documents** (NEW)
- Purpose: Upload/manage waivers, ID copies, medical certs
- Data: Document list with types and dates
- APIs: `GET/POST/DELETE /members/:id/documents`
- Components: File upload, document list, preview

**Screen: Family Memberships** (NEW)
- Purpose: Create/manage family plan groups
- Data: Family plan, primary + secondary members
- APIs: `CRUD /family-memberships`
- Components: Family card, add member modal, member chips

**Screen: Corporate Accounts** (NEW)
- Purpose: Manage corporate bulk memberships
- Data: Corporate accounts, linked members
- APIs: `CRUD /corporate/accounts`
- Components: Account cards, member assignment

### Check-ins Module

**Screen: Check-in Heatmap** (NEW)
- Purpose: Visualize gym usage patterns (7 days × 24 hours)
- Data: Heatmap matrix with check-in counts
- APIs: `GET /check-ins/heatmap`
- Components: Heatmap grid, week selector, color scale

### Payments Module

**Screen: Invoice Management** (NEW)
- Purpose: Create/view/manage member invoices
- Data: Invoice list, line items, status
- APIs: `CRUD /invoices`
- Components: Invoice table, create form, status updates, PDF preview

**Screen: Refund Processing** (NEW)
- Purpose: Process and track refunds
- Data: Refund list, linked payments
- APIs: `CRUD /refunds`
- Components: Refund form (linked to payment), status tracking

**Screen: Discount Management** (NEW)
- Purpose: Create/manage discount codes
- Data: Discount list, usage counts
- APIs: `CRUD /discounts`
- Components: Discount form, validation testing, active toggle

**Screen: Financial Reports** (NEW)
- Purpose: Daily/monthly revenue, membership breakdown, ledger
- Data: Period-based financial summaries
- APIs: `GET /financial-reports/daily`, `/monthly`, `/membership-revenue`, `/ledger`
- Components: Period selector, summary cards, data tables, export button

**Screen: Gateway Configuration** (NEW)
- Purpose: Configure Razorpay/Stripe
- Data: Gateway credentials, test mode toggle
- APIs: `CRUD /payment-gateways`
- Components: Config form per gateway, test connection button

### Classes Module

**Screen: Class Templates** (NEW)
- Purpose: Define reusable class types
- Data: Template list with defaults
- APIs: `CRUD /classes/templates`
- Components: Template table, create/edit form

**Screen: Session Scheduling** (NEW)
- Purpose: Schedule individual class sessions from templates
- Data: Sessions by date range, room/trainer conflicts
- APIs: `CRUD /classes/sessions`, room/trainer schedule
- Components: Calendar view, room/trainer dropdowns, conflict warnings

**Screen: Recurring Rules** (NEW)
- Purpose: Set up recurring class schedules
- Data: Rule definitions, generation status
- APIs: `CRUD /classes/sessions/recurring-rules`, `POST /generate`
- Components: Day/time picker, frequency selector, preview

**Screen: Room Management** (NEW)
- Purpose: Manage physical rooms/studios
- Data: Room list with capacity and equipment
- APIs: `CRUD /classes/sessions/rooms`
- Components: Room cards, schedule view

**Screen: Class Attendance** (NEW)
- Purpose: Mark attendance for a session, view history
- Data: Enrolled members, attendance status
- APIs: `POST /classes/bookings/attendance/:sessionId`, `POST /bulk`, `GET /attendance`
- Components: Member checklist, bulk mark, status indicators

**Screen: Member Bookings** (NEW)
- Purpose: View/manage a member's class bookings
- Data: Upcoming/past bookings, waitlist positions
- APIs: `GET /classes/bookings/member/:memberId`
- Components: Booking list, cancel button, waitlist indicator

### Staff Module

**Screen: Staff Attendance** (NEW)
- Purpose: Track staff check-in/out, attendance reports
- Data: Attendance records, lateness, overtime
- APIs: `POST /staff/attendance/check-in`, `PATCH /attendance/:id/check-out`, `GET /staff/:id/attendance`
- Components: Clock in/out button, attendance table, date filters

**Screen: Shift Management** (NEW)
- Purpose: Create/manage staff shift schedules
- Data: Shifts by staff, branch, date
- APIs: `CRUD /staff/shifts`
- Components: Calendar/table view, shift assignment form

**Screen: Trainer Client Management** (NEW)
- Purpose: Assign members to trainers, manage assignments
- Data: Client list, assignment status
- APIs: `POST /trainer/assign-client`, `GET /trainer/:id/clients`
- Components: Client assignment table, drag-drop

**Screen: PT Sessions** (NEW)
- Purpose: Schedule/manage personal training sessions
- Data: Session list, member, status
- APIs: `CRUD /trainer/sessions`
- Components: Session table, create form, calendar view

**Screen: Trainer Dashboard** (NEW)
- Purpose: Individual trainer's performance overview
- Data: KPIs, clients, revenue, schedule
- APIs: `GET /trainer/:id/dashboard`
- Components: KPI cards, client list, upcoming sessions

**Screen: Payroll Management** (NEW)
- Purpose: Configure payroll rules, process payroll, view records
- Data: Payroll configs, processed records, summary
- APIs: `GET/POST /payroll/config`, `POST /payroll/process`, `GET /payroll/records`, `GET /payroll/summary`, `GET /payroll/revenue`
- Components: Config form, process button, records table, revenue breakdown

### Marketing Module

**Screen: Lead Management** (NEW)
- Purpose: Track sales leads through pipeline
- Data: Lead list, funnel analytics, activities
- APIs: `CRUD /leads`, `GET /leads/funnel`, `CRUD /leads/:id/activities`
- Components: Pipeline kanban/table, lead detail panel, activity timeline

**Screen: Campaign Detail & Analytics** (NEW)
- Purpose: View campaign performance, manage audience
- Data: Campaign stats, audience list, send/delivery metrics
- APIs: `GET /campaigns/:id`, `GET /campaigns/:id/analytics`, `GET /campaigns/:id/audience`, `POST /campaigns/:id/send`
- Components: Stats cards, audience table, send button

**Screen: Message Templates** (NEW)
- Purpose: Create/edit SMS/email/WhatsApp templates
- Data: Template list, preview
- APIs: `CRUD /message-templates`
- Components: Template editor (Markdown/HTML), channel selector, variable insertions

**Screen: Automation Workflows** (NEW)
- Purpose: Create trigger-action automation rules
- Data: Workflow list, trigger types, action chains
- APIs: `CRUD /workflows`, `CRUD /workflows/:id/actions`
- Components: Workflow builder, trigger selector, action list

**Screen: Referral Programs** (NEW)
- Purpose: Configure referral program rewards
- Data: Programs, stats, reward tiers
- APIs: `CRUD /referral-programs`, `GET /referral-programs/stats`
- Components: Program form, stats cards

### Inventory Module (ENTIRELY NEW)

**Screen: Products & Categories** (NEW)
- Purpose: Manage product catalog
- Data: Categories, products (SKU, barcode, price, images)
- APIs: `CRUD /product-categories`, `CRUD /products`
- Components: Category tree, product table, create/edit form

**Screen: Stock Management** (NEW)
- Purpose: View/adjust inventory levels
- Data: Stock by product by branch, low stock alerts
- APIs: `GET /inventory`, `POST /inventory/adjust`, `GET /inventory/low-stock`
- Components: Stock table, adjustment dialog, alert badges

**Screen: Suppliers** (NEW)
- Purpose: Manage vendor contacts
- Data: Supplier list
- APIs: `CRUD /suppliers`
- Components: Supplier table, create form

**Screen: Purchase Orders** (NEW)
- Purpose: Create/track purchase orders
- Data: PO list, items, status
- APIs: `CRUD /purchase-orders`, `POST /receive`, `PATCH /cancel`
- Components: PO table, create form with item lines, receive dialog

**Screen: POS Terminal** (NEW)
- Purpose: Point-of-sale for product sales
- Data: Products, cart, payment
- APIs: `POST /pos/sales`, `GET /pos/sales`, `POST /pos/returns`
- Components: Product grid, cart sidebar, payment dialog, receipt

### Reports Module (ENTIRELY NEW)

**Screen: Reports Hub** (NEW)
- Purpose: Central hub for all reports
- Data: Report types with descriptions
- APIs: Links to individual report endpoints
- Components: Report cards with links, export format selector

**Screen: Revenue Report** (NEW)
- Purpose: Revenue breakdown by period, branch, type
- APIs: `GET /reports/revenue`
- Components: Period selector, summary cards, chart, table

**Screen: Membership Report** (NEW)
- Purpose: Membership status, conversion, retention
- APIs: `GET /reports/membership`
- Components: Funnel chart, lifecycle breakdown, retention curve

**Screen: Attendance Report** (NEW)
- Purpose: Check-in patterns, class utilization
- APIs: `GET /reports/attendance`
- Components: Heatmap, utilization bar chart, peak hours

**Screen: Trainer Report** (NEW)
- Purpose: Trainer performance comparison
- APIs: `GET /reports/trainers`
- Components: Leaderboard, comparison charts

### Settings Module

**Screen: Session & Device Management** (NEW — under Settings)
- Purpose: View active sessions, manage trusted devices, see login history
- APIs: `GET /auth/sessions/*`, `GET /auth/sessions/devices`, `GET /auth/sessions/history`
- Components: Session list with revoke, device list with trust toggle, history table

**Screen: API Key Management** (NEW — under Settings)
- Purpose: Manage API keys for integrations
- APIs: `CRUD /auth/api-keys`
- Components: Key list, create form, scopes selector

**Screen: Webhook Management** (NEW — under Settings)
- Purpose: Configure webhooks for external systems
- APIs: `CRUD /webhooks`, `GET /webhooks/:id/deliveries`
- Components: Webhook table, event selector, delivery log

**Screen: Audit Log Viewer** (NEW — under Settings)
- Purpose: View system audit trail
- APIs: `GET /audit`, `/audit/by-module`, `/audit/by-user`
- Components: Log table, filters (module, user, date range)

### Platform Module

**Screen: Feature Flags** (NEW — admin)
- Purpose: Toggle features for organization
- APIs: `CRUD /platform/feature-flags`
- Components: Flag list with toggles, create form

**Screen: Compliance Dashboard** (NEW — admin)
- Purpose: GDPR consent management, data requests
- APIs: `CRUD /compliance/*`
- Components: Consent log, request table, retention policy

---

## 7. Phase 6 — Priority Development Roadmap

### Priority 1: Core SaaS (Revenue-Critical)

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 1.1 | Invoice Management | Medium | Enables proper billing workflow |
| 1.2 | Refund Processing | Small | Closes payment lifecycle |
| 1.3 | Discount Management | Small | Enables promotions |
| 1.4 | Financial Reports | Medium | Owner needs visibility into P&L |
| 1.5 | Gateway Configuration (Razorpay/Stripe) | Medium | Enables online payments |
| 1.6 | Expense List Page (dedicated) | Small | Currently inline in finance overview |
| 1.7 | Membership Assignment Flow | Small | Proper membership management |
| 1.8 | Family Memberships | Medium | Revenue expansion |
| 1.9 | Corporate Accounts | Medium | B2B revenue |

### Priority 2: Operations

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 2.1 | Class Templates | Small | Enables template-based scheduling |
| 2.2 | Session Scheduling | Medium | Proper class management |
| 2.3 | Class Attendance | Small | Critical for class-based plans |
| 2.4 | Room Management | Small | Prevents scheduling conflicts |
| 2.5 | Recurring Rules | Medium | Automates weekly schedule |
| 2.6 | Staff Attendance | Medium | Operational tracking |
| 2.7 | Shift Management | Medium | Staff scheduling |
| 2.8 | Check-in Heatmap | Small | Popular UX feature |
| 2.9 | Member Health Profile | Medium | Member engagement |
| 2.10 | Member Visit Analytics | Small | Engagement insights |

### Priority 3: Growth & Marketing

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 3.1 | Lead Management (pipeline) | Large | Sales conversion |
| 3.2 | Campaign Detail & Analytics | Medium | Campaign ROI measurement |
| 3.3 | Message Templates | Medium | Campaign creation workflow |
| 3.4 | Referral Programs | Medium | Organic growth |
| 3.5 | Automation Workflows | Large | Retention automation |
| 3.6 | Campaign Send (with audience) | Medium | Enables actual campaign execution |
| 3.7 | Push Notifications | Small | Member engagement |

### Priority 4: Analytics & Reports

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 4.1 | Reports Hub | Small | Central navigation |
| 4.2 | Revenue Report | Medium | Financial visibility |
| 4.3 | Membership Report | Medium | Retention insights |
| 4.4 | Attendance Report | Medium | Utilization optimization |
| 4.5 | Analytics Dashboard (deep-dive) | Large | Advanced insights |
| 4.6 | Trainer Report + Leaderboard | Medium | Performance management |
| 4.7 | Report Export (CSV/PDF) | Small | Data portability |

### Priority 5: Inventory & POS

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 5.1 | Products & Categories | Medium | Product catalog |
| 5.2 | Stock Management | Medium | Inventory tracking |
| 5.3 | POS Terminal | Large | Retail revenue |
| 5.4 | Suppliers | Small | Vendor management |
| 5.5 | Purchase Orders | Medium | Procurement |

### Priority 6: Staff Advanced

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 6.1 | Trainer Client Management | Medium | PT business |
| 6.2 | PT Sessions | Medium | PT scheduling |
| 6.3 | Trainer Dashboard | Medium | Trainer self-service |
| 6.4 | Payroll Management | Large | Payroll ops |

### Priority 7: Settings & Admin

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 7.1 | Session/Device Management | Small | Security |
| 7.2 | Audit Log Viewer | Small | Compliance |
| 7.3 | API Key Management | Small | Developer integration |
| 7.4 | Webhook Management | Medium | External integrations |
| 7.5 | Feature Flags | Small | Feature management |
| 7.6 | Compliance Dashboard | Medium | GDPR compliance |
| 7.7 | Member Tags | Small | Segmentation |
| 7.8 | Member Documents | Small | Document management |

### Priority 8: Enterprise (Multi-Org)

| # | Screen | Effort | Impact |
|---|--------|--------|--------|
| 8.1 | Organization Management | Large | Multi-brand support |
| 8.2 | Region Management | Medium | Geographic hierarchy |
| 8.3 | Franchise Owner Management | Medium | Franchise model |
| 8.4 | Branch Comparison Analytics | Medium | Multi-branch insights |
| 8.5 | White-label Configuration | Medium | Branding customization |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Backend endpoints fully used by frontend | ~62 |
| Backend endpoints partially used | ~12 |
| Backend endpoints with NO frontend | ~324 |
| Frontend pages needed (new) | ~42 |
| Frontend pages existing | 47 |
| **Total frontend pages when complete** | **~89** |

### Coverage by Module

| Module | Backend Endpoints | Frontend Coverage |
|--------|------------------|-------------------|
| Auth | 38 | 35% (login/register done; sessions/devices/admin missing) |
| Members | 47 | 30% (CRUD done; profiles/stats/tags/documents/family/corporate missing) |
| Check-ins | 5 | 80% (heatmap + offline sync missing) |
| Payments | 32 | 20% (cash + list done; invoices/refunds/discounts/reports missing) |
| Dashboard | 5 | 100% ✅ |
| Classes | 30 | 20% (basic CRUD done; templates/sessions/bookings/attendance missing) |
| Staff | 29 | 15% (list + profile done; attendance/shifts/PT/payroll missing) |
| Marketing | 28 | 10% (campaign list done; leads/templates/workflows/referrals missing) |
| AI | 3 | 67% (conversation history missing) |
| Analytics | 18 | 5% (trainer chart partial; entire module missing) |
| Inventory | 27 | 0% ❌ |
| Organization | 19 | 0% ❌ |
| Compliance | 8 | 0% ❌ |
| Platform | 26 | 0% ❌ |
| Search | 2 | 50% (local search only, no API) |
| Audit | 3 | 0% ❌ |
| Settings | 6 | 83% (branch summary missing) |
| Roles | 6 | 100% ✅ |
| Branches | 7 | 57% (settings missing) |

---

*End of audit report.*
