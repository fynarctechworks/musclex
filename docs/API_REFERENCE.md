# MuscleX — Backend API Reference

> Auto-extracted from 86 NestJS controllers on 2026-06-04 (static parse of
> `@Controller` + verb decorators — no app run). **676 routes total.**
> Path prefix `api/v1` is baked into each `@Controller`. Member routes (`/api/v1/member/*`)
> authenticate with the **member JWT**; all others use the staff JWT + `JwtAuthGuard` +
> `TenantMiddleware` (except `auth/*` and `health`). Request/response DTOs live beside each
> controller. This table is generated — regenerate rather than hand-edit.


## Staff / Admin API

### `/api/v1/ai` — [backend/src/ai/ai.controller.ts](backend/src/ai/ai.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/ai/chat` | chat |
| GET | `/api/v1/ai/daily-briefing` | getDailyBriefing |
| GET | `/api/v1/ai/conversations` | getConversations |

### `/api/v1/analytics` — [backend/src/analytics/controllers/dashboard-analytics.controller.ts](backend/src/analytics/controllers/dashboard-analytics.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/analytics/dashboard` | getDashboardSummary |
| GET | `/api/v1/analytics/daily-metrics` | getDailyMetrics |
| GET | `/api/v1/analytics/daily-metrics/trend` | getDailyMetricsTrend |
| GET | `/api/v1/analytics/revenue` | getRevenueAnalytics |
| GET | `/api/v1/analytics/memberships` | getMembershipAnalytics |
| GET | `/api/v1/analytics/classes` | getClassAnalytics |
| GET | `/api/v1/analytics/members/behavior` | getMemberBehavior |
| GET | `/api/v1/analytics/members/churn-risk` | getChurnRiskSummary |
| GET | `/api/v1/analytics/trainers` | getTrainerAnalytics |
| GET | `/api/v1/analytics/trainers/leaderboard` | getTrainerLeaderboard |
| GET | `/api/v1/analytics/campaigns` | getCampaignAnalytics |
| GET | `/api/v1/analytics/branch-comparison` | getBranchComparison |

### `/api/v1/reports` — [backend/src/analytics/controllers/reports.controller.ts](backend/src/analytics/controllers/reports.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/reports/export` | exportReport |
| GET | `/api/v1/reports/revenue` | getRevenueReport |
| GET | `/api/v1/reports/membership` | getMembershipReport |
| GET | `/api/v1/reports/attendance` | getAttendanceReport |
| GET | `/api/v1/reports/trainers` | getTrainerReport |
| GET | `/api/v1/reports/inventory` | getInventoryReport |

### `(root)` — [backend/src/app.controller.ts](backend/src/app.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/health` | health |
| GET | `/debug/sentry-test` | sentryTest |

### `/api/v1/audit` — [backend/src/audit/audit.controller.ts](backend/src/audit/audit.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/audit` | findRecent |
| GET | `/api/v1/audit/by-module` | findByModule |
| GET | `/api/v1/audit/by-user` | findByUser |

### `/api/v1/auth/api-keys` — [backend/src/auth/auth-api-key.controller.ts](backend/src/auth/auth-api-key.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/auth/api-keys` | listApiKeys |
| GET | `/api/v1/auth/api-keys/:id` | getApiKey |
| POST | `/api/v1/auth/api-keys` | createApiKey |
| PATCH | `/api/v1/auth/api-keys/:id` | updateApiKey |
| POST | `/api/v1/auth/api-keys/:id/deactivate` | deactivateApiKey |
| POST | `/api/v1/auth/api-keys/:id/reactivate` | reactivateApiKey |
| DELETE | `/api/v1/auth/api-keys/:id` | deleteApiKey |

### `/api/v1/auth/sessions` — [backend/src/auth/auth-session.controller.ts](backend/src/auth/auth-session.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/auth/sessions` | getActiveSessions |
| POST | `/api/v1/auth/sessions/revoke` | revokeSession |
| POST | `/api/v1/auth/sessions/revoke-all` | revokeAllSessions |
| GET | `/api/v1/auth/sessions/devices` | getDevices |
| POST | `/api/v1/auth/sessions/devices/:deviceId/trust` | trustDevice |
| POST | `/api/v1/auth/sessions/devices/:deviceId/untrust` | untrustDevice |
| DELETE | `/api/v1/auth/sessions/devices/:deviceId` | removeDevice |
| GET | `/api/v1/auth/sessions/history` | getLoginHistory |
| GET | `/api/v1/auth/sessions/identity` | getIdentity |
| GET | `/api/v1/auth/sessions/login-history` | getLoginHistory |
| POST | `/api/v1/auth/sessions/users/:userId/suspend` | suspendUser |
| POST | `/api/v1/auth/sessions/users/:userId/reactivate` | reactivateUser |
| POST | `/api/v1/auth/sessions/users/:userId/revoke-sessions` | revokeUserSessions |

### `/api/v1/auth/sso` — [backend/src/auth/auth-sso.controller.ts](backend/src/auth/auth-sso.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/auth/sso/providers/active` | getActiveProviders |
| GET | `/api/v1/auth/sso/providers` | listProviders |
| GET | `/api/v1/auth/sso/providers/:id` | getProvider |
| POST | `/api/v1/auth/sso/providers` | createProvider |
| PATCH | `/api/v1/auth/sso/providers/:id` | updateProvider |
| DELETE | `/api/v1/auth/sso/providers/:id` | deleteProvider |

### `/api/v1/auth` — [backend/src/auth/auth.controller.ts](backend/src/auth/auth.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/auth/register` | register |
| POST | `/api/v1/auth/verify-email` | verifyEmail |
| POST | `/api/v1/auth/resend-verification` | resendVerification |
| GET | `/api/v1/auth/plans` | getPlans |
| POST | `/api/v1/auth/select-plan` | selectPlan |
| POST | `/api/v1/auth/setup-studio` | setupStudio |
| POST | `/api/v1/auth/onboarding/branches` | onboardingBranches |
| POST | `/api/v1/auth/onboarding/memberships` | onboardingMemberships |
| POST | `/api/v1/auth/onboarding/staff` | onboardingStaff |
| POST | `/api/v1/auth/onboarding/subscription` | onboardingSubscription |
| POST | `/api/v1/auth/onboarding/payment` | onboardingPayment |
| POST | `/api/v1/auth/onboarding/skip` | onboardingSkip |
| POST | `/api/v1/auth/login` | login |
| POST | `/api/v1/auth/logout` | logout |
| POST | `/api/v1/auth/refresh` | refresh |
| GET | `/api/v1/auth/me` | getMe |
| POST | `/api/v1/auth/forgot-password` | forgotPassword |
| POST | `/api/v1/auth/reset-password` | resetPassword |
| POST | `/api/v1/auth/onboarding` | onboarding |
| POST | `/api/v1/auth/select-workspace` | selectWorkspace |

### `/api/v1/auth/2fa` — [backend/src/auth/two-factor.controller.ts](backend/src/auth/two-factor.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/auth/2fa/setup` | setup |
| POST | `/api/v1/auth/2fa/verify` | verify |
| POST | `/api/v1/auth/2fa/login` | login |
| POST | `/api/v1/auth/2fa/disable` | disable |
| GET | `/api/v1/auth/2fa/status` | status |
| POST | `/api/v1/auth/2fa/admin-reset/:userId` | adminReset |
| POST | `/api/v1/auth/2fa/recover-2fa` | recover |
| POST | `/api/v1/auth/2fa/reset-2fa` | reset |

### `/api/v1/branches` — [backend/src/branches/branches.controller.ts](backend/src/branches/branches.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/branches` | findAll |
| GET | `/api/v1/branches/:id` | findOne |
| POST | `/api/v1/branches` | create |
| PATCH | `/api/v1/branches/:id` | update |
| DELETE | `/api/v1/branches/:id` | remove |
| POST | `/api/v1/branches/:id/retry-provision` | retryProvision |
| GET | `/api/v1/branches/:id/settings` | getSettings |
| PATCH | `/api/v1/branches/:id/settings` | updateSettings |

### `/api/v1/check-ins/biometric` — [backend/src/check-ins/biometric/biometric.controller.ts](backend/src/check-ins/biometric/biometric.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/check-ins/biometric/providers` | listProviders |
| GET | `/api/v1/check-ins/biometric/members/:id` | listForMember |
| GET | `/api/v1/check-ins/biometric/enrollments` | listAllEnrollments |
| POST | `/api/v1/check-ins/biometric/enroll` | enroll |
| DELETE | `/api/v1/check-ins/biometric/enrollments/:id` | revoke |

### `/api/v1/check-ins` — [backend/src/check-ins/check-ins.controller.ts](backend/src/check-ins/check-ins.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/check-ins` | create |
| POST | `/api/v1/check-ins/facial` | facialCheckIn |
| POST | `/api/v1/check-ins/check-out` | checkOut |
| GET | `/api/v1/check-ins/open` | listOpen |
| POST | `/api/v1/check-ins/sync` | syncOffline |
| GET | `/api/v1/check-ins` | findAll |
| GET | `/api/v1/check-ins/heatmap` | getHeatmap |

### `/api/v1/check-ins/device/:device_id/scan` — [backend/src/check-ins/devices/device-checkin.controller.ts](backend/src/check-ins/devices/device-checkin.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/check-ins/device/:device_id/scan` | scan |

### `/api/v1/check-ins/devices` — [backend/src/check-ins/devices/devices.controller.ts](backend/src/check-ins/devices/devices.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/check-ins/devices` | register |
| GET | `/api/v1/check-ins/devices` | list |
| GET | `/api/v1/check-ins/devices/:id` | get |
| DELETE | `/api/v1/check-ins/devices/:id` | disable |
| POST | `/api/v1/check-ins/devices/:id/lost` | markLost |

### `/api/v1/check-ins/qr` — [backend/src/check-ins/qr/qr.controller.ts](backend/src/check-ins/qr/qr.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/check-ins/qr/members/:id` | getStatic |
| POST | `/api/v1/check-ins/qr/members/:id/regenerate` | regenerate |
| GET | `/api/v1/check-ins/qr/members/:id/dynamic` | getDynamic |

### `/api/v1/classes/bookings` — [backend/src/classes/booking.controller.ts](backend/src/classes/booking.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/classes/bookings` | bookClass |
| POST | `/api/v1/classes/bookings/:id/cancel` | cancelBooking |
| GET | `/api/v1/classes/bookings/session/:sessionId` | getSessionBookings |
| GET | `/api/v1/classes/bookings/member/:memberId` | getMemberBookings |
| GET | `/api/v1/classes/bookings/waitlist/:sessionId/:memberId` | getWaitlistPosition |
| DELETE | `/api/v1/classes/bookings/waitlist/:sessionId/:memberId` | removeFromWaitlist |
| POST | `/api/v1/classes/bookings/attendance/:sessionId` | markAttendance |
| POST | `/api/v1/classes/bookings/attendance/:sessionId/bulk` | bulkMarkAttendance |
| GET | `/api/v1/classes/bookings/attendance/:sessionId` | getSessionAttendance |
| GET | `/api/v1/classes/bookings/attendance/member/:memberId` | getMemberAttendanceHistory |
| POST | `/api/v1/classes/bookings/attendance/:sessionId/complete` | completeSession |

### `/api/v1/classes/templates` — [backend/src/classes/class-template.controller.ts](backend/src/classes/class-template.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/classes/templates` | create |
| GET | `/api/v1/classes/templates` | findAll |
| GET | `/api/v1/classes/templates/:id` | findOne |
| PATCH | `/api/v1/classes/templates/:id` | update |
| DELETE | `/api/v1/classes/templates/:id` | remove |

### `/api/v1/classes` — [backend/src/classes/classes.controller.ts](backend/src/classes/classes.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/classes` | create |
| GET | `/api/v1/classes` | findAll |
| GET | `/api/v1/classes/:id` | findOne |
| PATCH | `/api/v1/classes/:id` | update |
| POST | `/api/v1/classes/:id/enroll` | enroll |
| POST | `/api/v1/classes/:id/cancel-enrollment` | cancelEnrollment |
| POST | `/api/v1/classes/:id/promote-waitlist` | promoteFromWaitlist |

### `/api/v1/classes/sessions` — [backend/src/classes/session.controller.ts](backend/src/classes/session.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/classes/sessions` | createSession |
| GET | `/api/v1/classes/sessions` | findAllSessions |
| GET | `/api/v1/classes/sessions/:id` | findOneSession |
| PATCH | `/api/v1/classes/sessions/:id` | updateSession |
| POST | `/api/v1/classes/sessions/:id/cancel` | cancelSession |
| GET | `/api/v1/classes/sessions/trainer/:trainerId/schedule` | getTrainerSchedule |
| GET | `/api/v1/classes/sessions/room/:studioId/schedule` | getRoomSchedule |
| POST | `/api/v1/classes/sessions/rooms` | createRoom |
| GET | `/api/v1/classes/sessions/rooms` | findAllRooms |
| GET | `/api/v1/classes/sessions/rooms/:id` | findOneRoom |
| PATCH | `/api/v1/classes/sessions/rooms/:id` | updateRoom |
| POST | `/api/v1/classes/sessions/recurring-rules` | createRecurringRule |
| GET | `/api/v1/classes/sessions/recurring-rules` | findRecurringRules |
| POST | `/api/v1/classes/sessions/recurring-rules/:id/deactivate` | deactivateRecurringRule |
| POST | `/api/v1/classes/sessions/recurring-rules/generate` | generateRecurringSessions |

### `/observability` — [backend/src/common/observability/observability.controller.ts](backend/src/common/observability/observability.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/observability/report` | report |

### `/api/v1/compliance` — [backend/src/compliance/compliance.controller.ts](backend/src/compliance/compliance.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/compliance/consents` | recordConsent |
| GET | `/api/v1/compliance/consents/:memberId` | getMemberConsents |
| GET | `/api/v1/compliance/consents/:memberId/history` | getConsentHistory |
| POST | `/api/v1/compliance/data-export` | requestDataExport |
| POST | `/api/v1/compliance/data-deletion` | requestDataDeletion |
| POST | `/api/v1/compliance/data-deletion/:requestId/process` | processDeletion |
| GET | `/api/v1/compliance/data-deletion` | getDeletionRequests |
| GET | `/api/v1/compliance/retention-policy` | getRetentionPolicy |

### `/api/v1/dashboard` — [backend/src/dashboard/dashboard-actions.controller.ts](backend/src/dashboard/dashboard-actions.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/dashboard/actions` | getActions |
| POST | `/api/v1/dashboard/actions/:id/dismiss` | dismissAction |
| POST | `/api/v1/dashboard/actions/:id/snooze` | snoozeAction |
| POST | `/api/v1/dashboard/actions/:id/resolve` | resolveAction |
| GET | `/api/v1/dashboard/action-receipts` | getActionReceipts |
| GET | `/api/v1/dashboard/push/public-key` | getPushPublicKey |
| POST | `/api/v1/dashboard/push/subscribe` | subscribePush |
| POST | `/api/v1/dashboard/push/unsubscribe` | unsubscribePush |

### `/api/v1/dashboard` — [backend/src/dashboard/dashboard-intelligence.controller.ts](backend/src/dashboard/dashboard-intelligence.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/dashboard/revenue-mix` | getRevenueMix |
| GET | `/api/v1/dashboard/payment-methods` | getPaymentMethods |
| GET | `/api/v1/dashboard/revenue-summary` | getRevenueSummary |
| GET | `/api/v1/dashboard/cohorts` | getCohorts |
| GET | `/api/v1/dashboard/segments` | getSegments |
| GET | `/api/v1/dashboard/business-metrics` | getBusinessMetrics |

### `/api/v1/dashboard` — [backend/src/dashboard/dashboard-layout.controller.ts](backend/src/dashboard/dashboard-layout.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/dashboard/tiles` | getTiles |
| GET | `/api/v1/dashboard/layout` | getLayout |
| POST | `/api/v1/dashboard/layout` | saveLayout |
| POST | `/api/v1/dashboard/layout/reset` | resetLayout |

### `/api/v1/dashboard` — [backend/src/dashboard/dashboard-ops.controller.ts](backend/src/dashboard/dashboard-ops.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/dashboard/occupancy` | getOccupancy |
| GET | `/api/v1/dashboard/today-classes` | getTodayClasses |
| GET | `/api/v1/dashboard/heatmap` | getHeatmap |
| GET | `/api/v1/dashboard/system-status` | getSystemStatus |
| GET | `/api/v1/dashboard/inventory` | getInventory |

### `/api/v1/dashboard` — [backend/src/dashboard/dashboard.controller.ts](backend/src/dashboard/dashboard.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/dashboard/kpis` | getKpis |
| GET | `/api/v1/dashboard/pulse` | getPulse |
| GET | `/api/v1/dashboard/revenue-chart` | getRevenueChart |
| GET | `/api/v1/dashboard/activity-feed` | getActivityFeed |
| GET | `/api/v1/dashboard/alerts` | getAlerts |
| GET | `/api/v1/dashboard/branch-comparison` | getBranchComparison |
| GET | `/api/v1/dashboard/setup-status` | getSetupStatus |
| GET | `/api/v1/dashboard/portfolio` | getPortfolio |
| GET | `/api/v1/dashboard/trainer-cockpit` | getTrainerCockpit |
| GET | `/api/v1/dashboard/briefing` | getBriefing |
| POST | `/api/v1/dashboard/briefing/regenerate` | regenerateBriefing |
| GET | `/api/v1/dashboard/inspect/:metric` | inspectKpi |
| GET | `/api/v1/dashboard/restatements` | getRestatements |
| POST | `/api/v1/dashboard/snapshots/capture` | captureSnapshot |
| GET | `/api/v1/dashboard/plan-usage` | getPlanUsage |
| POST | `/api/v1/dashboard/resync` | resyncMetrics |
| POST | `/api/v1/dashboard/catchup` | catchupEvents |
| POST | `/api/v1/dashboard/replay` | replayEvents |

### `/api/v1` — [backend/src/documents/documents.controller.ts](backend/src/documents/documents.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/invoices/:id/pdf` | invoicePdf |
| POST | `/api/v1/invoices/:id/send` | sendInvoice |
| GET | `/api/v1/pos/sales/:id/receipt` | posReceipt |
| POST | `/api/v1/pos/sales/:id/send-receipt` | sendPosReceipt |

### `/api/v1` — [backend/src/inventory/bundles.controller.ts](backend/src/inventory/bundles.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/bundles` | create |
| GET | `/api/v1/bundles` | findAll |
| GET | `/api/v1/bundles/:id` | findOne |
| PATCH | `/api/v1/bundles/:id` | update |
| DELETE | `/api/v1/bundles/:id` | remove |

### `/api/v1/pos` — [backend/src/inventory/pos.controller.ts](backend/src/inventory/pos.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/pos/sales` | createSale |
| GET | `/api/v1/pos/sales` | findAllSales |
| GET | `/api/v1/pos/sales/daily-report` | getDailySalesReport |
| GET | `/api/v1/pos/sales/top-products` | getTopSellingProducts |
| GET | `/api/v1/pos/sales/:id` | findOneSale |
| POST | `/api/v1/pos/returns` | processReturn |

### `/api/v1` — [backend/src/inventory/products.controller.ts](backend/src/inventory/products.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/product-categories` | createCategory |
| GET | `/api/v1/product-categories` | findAllCategories |
| PATCH | `/api/v1/product-categories/:id` | updateCategory |
| POST | `/api/v1/products` | createProduct |
| GET | `/api/v1/products` | findAllProducts |
| GET | `/api/v1/products/barcode/:barcode` | findByBarcode |
| GET | `/api/v1/products/sku/:sku` | findBySku |
| GET | `/api/v1/products/:id` | findOneProduct |
| PATCH | `/api/v1/products/:id` | updateProduct |
| GET | `/api/v1/products/:id/images` | listProductImages |
| POST | `/api/v1/products/:id/images` | addProductImage |
| PATCH | `/api/v1/products/:id/images/reorder` | reorderProductImages |
| PATCH | `/api/v1/products/:id/images/:imageId/primary` | setPrimaryProductImage |
| DELETE | `/api/v1/products/:id/images/:imageId` | removeProductImage |
| GET | `/api/v1/inventory` | getInventory |
| POST | `/api/v1/inventory/adjust` | adjustInventory |
| PATCH | `/api/v1/inventory/:productId/reorder-level` | updateReorderLevel |
| GET | `/api/v1/inventory/transactions` | getTransactions |
| GET | `/api/v1/inventory/low-stock` | getLowStockAlerts |
| POST | `/api/v1/batches` | createBatch |
| GET | `/api/v1/batches` | findBatches |
| GET | `/api/v1/batches/expiring` | getExpiringBatches |
| PATCH | `/api/v1/batches/:id/adjust` | adjustBatch |

### `/api/v1` — [backend/src/inventory/suppliers.controller.ts](backend/src/inventory/suppliers.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/suppliers` | createSupplier |
| GET | `/api/v1/suppliers` | findAllSuppliers |
| GET | `/api/v1/suppliers/:id` | findOneSupplier |
| PATCH | `/api/v1/suppliers/:id` | updateSupplier |
| POST | `/api/v1/purchase-orders` | createPurchaseOrder |
| GET | `/api/v1/purchase-orders` | findAllOrders |
| GET | `/api/v1/purchase-orders/:id` | findOneOrder |
| POST | `/api/v1/purchase-orders/:id/receive` | receivePurchaseOrder |
| PATCH | `/api/v1/purchase-orders/:id/cancel` | cancelOrder |

### `/api/v1` — [backend/src/inventory/transfers.controller.ts](backend/src/inventory/transfers.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/transfers` | createTransfer |
| GET | `/api/v1/transfers` | findAll |
| GET | `/api/v1/transfers/:id` | findOne |
| PATCH | `/api/v1/transfers/:id/receive` | receive |
| PATCH | `/api/v1/transfers/:id/cancel` | cancel |
| POST | `/api/v1/branch-prices` | upsertBranchPrice |
| GET | `/api/v1/products/:productId/branch-prices` | getBranchPrices |
| DELETE | `/api/v1/products/:productId/branch-prices/:branchId` | deleteBranchPrice |

### `/api/v1/invoice-templates` — [backend/src/invoices/invoice-templates.controller.ts](backend/src/invoices/invoice-templates.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/invoice-templates` | getTemplates |

### `/api/v1` — [backend/src/marketing/automation.controller.ts](backend/src/marketing/automation.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/message-templates/seed-defaults` | seedDefaultTemplates |
| POST | `/api/v1/message-templates` | createTemplate |
| GET | `/api/v1/message-templates` | findAllTemplates |
| GET | `/api/v1/message-templates/:id` | findOneTemplate |
| PATCH | `/api/v1/message-templates/:id` | updateTemplate |
| DELETE | `/api/v1/message-templates/:id` | deleteTemplate |
| POST | `/api/v1/workflows/seed-defaults` | seedDefaultWorkflows |
| POST | `/api/v1/workflows` | createWorkflow |
| GET | `/api/v1/workflows` | findAllWorkflows |
| GET | `/api/v1/workflows/:id` | findOneWorkflow |
| PATCH | `/api/v1/workflows/:id` | updateWorkflow |
| POST | `/api/v1/workflows/:id/actions` | addWorkflowAction |
| DELETE | `/api/v1/workflows/:workflowId/actions/:actionId` | removeWorkflowAction |
| DELETE | `/api/v1/workflows/:id` | deleteWorkflow |
| POST | `/api/v1/referral-programs` | createReferralProgram |
| GET | `/api/v1/referral-programs` | findAllReferralPrograms |
| GET | `/api/v1/referral-programs/stats` | getReferralStats |
| GET | `/api/v1/referral-programs/:id` | findOneReferralProgram |
| PATCH | `/api/v1/referral-programs/:id` | updateReferralProgram |
| POST | `/api/v1/push-notifications` | sendPushNotification |
| GET | `/api/v1/push-notifications/:memberId` | getMemberNotifications |
| PATCH | `/api/v1/push-notifications/:id/read` | markNotificationRead |

### `/api/v1/leads` — [backend/src/marketing/leads.controller.ts](backend/src/marketing/leads.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/leads` | create |
| GET | `/api/v1/leads` | findAll |
| GET | `/api/v1/leads/funnel` | getFunnelAnalytics |
| GET | `/api/v1/leads/:id` | findOne |
| PATCH | `/api/v1/leads/:id` | update |
| POST | `/api/v1/leads/:id/activities` | addActivity |
| GET | `/api/v1/leads/:id/activities` | getActivities |

### `/api/v1/campaigns` — [backend/src/marketing/marketing.controller.ts](backend/src/marketing/marketing.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/campaigns` | findAll |
| POST | `/api/v1/campaigns` | create |
| GET | `/api/v1/campaigns/:id` | findOne |
| PATCH | `/api/v1/campaigns/:id` | update |
| DELETE | `/api/v1/campaigns/:id` | remove |
| POST | `/api/v1/campaigns/:id/send` | sendCampaign |
| GET | `/api/v1/campaigns/:id/audience` | getCampaignAudience |
| PATCH | `/api/v1/campaigns/:campaignId/audience/:memberId` | updateAudienceStatus |
| GET | `/api/v1/campaigns/:id/analytics` | getCampaignAnalytics |

### `/api/v1/corporate` — [backend/src/members/corporate.controller.ts](backend/src/members/corporate.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/corporate/accounts` | createAccount |
| GET | `/api/v1/corporate/accounts` | findAllAccounts |
| GET | `/api/v1/corporate/accounts/:id` | findOneAccount |
| PATCH | `/api/v1/corporate/accounts/:id` | updateAccount |
| GET | `/api/v1/corporate/accounts/:id/members` | getAccountMembers |
| POST | `/api/v1/corporate/accounts/:id/members` | addMember |
| DELETE | `/api/v1/corporate/accounts/:id/members/:memberId` | removeMember |

### `/api/v1/family-memberships` — [backend/src/members/family.controller.ts](backend/src/members/family.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/family-memberships` | create |
| GET | `/api/v1/family-memberships/:id` | findOne |
| GET | `/api/v1/family-memberships/member/:memberId` | findByMember |
| POST | `/api/v1/family-memberships/:id/members` | addMember |
| DELETE | `/api/v1/family-memberships/:id/members/:memberId` | removeMember |

### `/api/v1/members` — [backend/src/members/member-visits.controller.ts](backend/src/members/member-visits.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/members/:id/visit-history` | getVisits |
| GET | `/api/v1/members/:id/visit-streak` | getStreak |
| GET | `/api/v1/members/:id/attendance-by-month` | getAttendanceByMonth |

### `/api/v1/members` — [backend/src/members/members.controller.ts](backend/src/members/members.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/members` | findAll |
| GET | `/api/v1/members/check-phone` | checkPhone |
| GET | `/api/v1/members/churn-risk` | getChurnRisk |
| GET | `/api/v1/members/lifecycle` | getLifecycle |
| POST | `/api/v1/members` | create |
| GET | `/api/v1/members/:id` | findOne |
| PATCH | `/api/v1/members/:id` | update |
| DELETE | `/api/v1/members/:id` | softDelete |
| POST | `/api/v1/members/:id/freeze` | freeze |
| POST | `/api/v1/members/:id/unfreeze` | unfreeze |
| POST | `/api/v1/members/:id/renew` | renew |
| POST | `/api/v1/members/:id/face-descriptor` | saveFaceDescriptor |
| GET | `/api/v1/members/:id/profile` | getProfile |
| PATCH | `/api/v1/members/:id/profile` | upsertProfile |
| GET | `/api/v1/members/:id/body-stats` | getBodyStats |
| POST | `/api/v1/members/:id/body-stats` | createBodyStats |
| PATCH | `/api/v1/members/body-stats/:statsId` | updateBodyStats |
| DELETE | `/api/v1/members/body-stats/:statsId` | deleteBodyStats |
| GET | `/api/v1/members/:id/progress` | getProgressSummary |
| GET | `/api/v1/members/:id/progress-photos` | getProgressPhotos |
| POST | `/api/v1/members/:id/progress-photos` | createProgressPhoto |
| DELETE | `/api/v1/members/progress-photos/:photoId` | deleteProgressPhoto |
| GET | `/api/v1/members/:id/visits` | getVisitStats |
| GET | `/api/v1/members/:id/notes` | getNotes |
| POST | `/api/v1/members/:id/notes` | createNote |
| DELETE | `/api/v1/members/notes/:noteId` | deleteNote |
| GET | `/api/v1/members/tags/all` | getAllTags |
| POST | `/api/v1/members/tags` | createTag |
| DELETE | `/api/v1/members/tags/:tagId` | deleteTag |
| GET | `/api/v1/members/:id/tags` | getMemberTags |
| POST | `/api/v1/members/:id/tags` | assignTag |
| DELETE | `/api/v1/members/:id/tags/:tagId` | removeTag |
| GET | `/api/v1/members/:id/documents` | getDocuments |
| POST | `/api/v1/members/:id/documents` | uploadDocument |
| PATCH | `/api/v1/members/documents/:documentId` | updateDocument |
| DELETE | `/api/v1/members/documents/:documentId` | deleteDocument |
| GET | `/api/v1/members/:id/referrals` | getReferrals |
| POST | `/api/v1/members/referrals` | createReferral |
| PATCH | `/api/v1/members/referrals/:referralId` | updateReferralStatus |

### `/api/v1/members` — [backend/src/members/membership-access.controller.ts](backend/src/members/membership-access.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/members/:id/transfer` | transfer |
| GET | `/api/v1/members/:id/transfers` | history |
| POST | `/api/v1/members/:id/temporary-access` | grantTemporary |
| GET | `/api/v1/members/memberships/:membershipId/access` | listAccess |
| DELETE | `/api/v1/members/memberships/:membershipId/access/:branchId` | revoke |

### `/api/v1/memberships` — [backend/src/members/memberships.controller.ts](backend/src/members/memberships.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/memberships/assign/:memberId` | assign |
| GET | `/api/v1/memberships/member/:memberId` | findByMember |
| GET | `/api/v1/memberships/:id` | findOne |
| POST | `/api/v1/memberships/:id/freeze` | freeze |
| POST | `/api/v1/memberships/:id/unfreeze` | unfreeze |
| POST | `/api/v1/memberships/:id/cancel` | cancel |
| POST | `/api/v1/memberships/:id/renew` | renew |
| PATCH | `/api/v1/memberships/:id/auto-renew` | toggleAutoRenew |
| POST | `/api/v1/memberships/:id/track-visit` | trackVisit |
| GET | `/api/v1/memberships/stats/summary` | getStats |
| POST | `/api/v1/memberships/admin/run-expiry` | runExpiry |
| POST | `/api/v1/memberships/admin/run-auto-renew` | runAutoRenew |

### `/api/v1/membership-plans` — [backend/src/members/plans.controller.ts](backend/src/members/plans.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/membership-plans` | findAll |
| GET | `/api/v1/membership-plans/by-type/:planType` | findByType |
| GET | `/api/v1/membership-plans/:id` | findOne |
| POST | `/api/v1/membership-plans` | create |
| PATCH | `/api/v1/membership-plans/:id` | update |
| DELETE | `/api/v1/membership-plans/:id` | remove |

### `/api/v1/internal` — [backend/src/onboarding/internal.controller.ts](backend/src/onboarding/internal.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/internal/cache/invalidate` | invalidateCache |

### `/api/v1/onboarding` — [backend/src/onboarding/onboarding-plans.controller.ts](backend/src/onboarding/onboarding-plans.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/onboarding/plans` | getPlans |

### `/api/v1/franchise-owners` — [backend/src/organization/franchise.controller.ts](backend/src/organization/franchise.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/franchise-owners` | findAll |
| GET | `/api/v1/franchise-owners/:id` | findOne |
| POST | `/api/v1/franchise-owners` | create |
| PATCH | `/api/v1/franchise-owners/:id` | update |
| POST | `/api/v1/franchise-owners/branch-assignments` | assignBranch |
| DELETE | `/api/v1/franchise-owners/:franchiseOwnerId/branches/:branchId` | unassignBranch |
| GET | `/api/v1/franchise-owners/:id/branches` | getBranches |

### `/api/v1/organizations` — [backend/src/organization/organization.controller.ts](backend/src/organization/organization.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/organizations` | findAll |
| GET | `/api/v1/organizations/:id` | findOne |
| GET | `/api/v1/organizations/slug/:slug` | findBySlug |
| GET | `/api/v1/organizations/:id/hierarchy` | getHierarchy |
| POST | `/api/v1/organizations` | create |
| PATCH | `/api/v1/organizations/:id` | update |
| GET | `/api/v1/organizations/:id/settings` | getSettings |
| PATCH | `/api/v1/organizations/:id/settings` | updateSettings |

### `/api/v1/regions` — [backend/src/organization/region.controller.ts](backend/src/organization/region.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/regions` | findAll |
| GET | `/api/v1/regions/:id` | findOne |
| POST | `/api/v1/regions` | create |
| PATCH | `/api/v1/regions/:id` | update |
| DELETE | `/api/v1/regions/:id` | deactivate |

### `/api/v1` — [backend/src/payments/discounts.controller.ts](backend/src/payments/discounts.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/discounts` | createDiscount |
| GET | `/api/v1/discounts` | findAllDiscounts |
| GET | `/api/v1/discounts/validate/:code` | validateDiscountCode |
| GET | `/api/v1/discounts/:id` | findOneDiscount |
| PATCH | `/api/v1/discounts/:id` | updateDiscount |
| POST | `/api/v1/tax-rates` | createTaxRate |
| GET | `/api/v1/tax-rates` | findAllTaxRates |
| PATCH | `/api/v1/tax-rates/:id` | updateTaxRate |
| POST | `/api/v1/payment-gateways` | createGatewayConfig |
| GET | `/api/v1/payment-gateways` | findAllGatewayConfigs |
| PATCH | `/api/v1/payment-gateways/:id` | updateGatewayConfig |

### `/api/v1/expenses` — [backend/src/payments/expenses.controller.ts](backend/src/payments/expenses.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/expenses` | create |
| GET | `/api/v1/expenses` | findAll |
| GET | `/api/v1/expenses/timeline` | timeline |
| GET | `/api/v1/expenses/summary` | summary |
| GET | `/api/v1/expenses/intelligence` | getIntelligence |
| GET | `/api/v1/expenses/export` | exportFile |
| GET | `/api/v1/expenses/:id` | getOne |
| POST | `/api/v1/expenses/:id/reverse` | reverse |
| PATCH | `/api/v1/expenses/:id` | legacyUpdate |
| DELETE | `/api/v1/expenses/:id` | legacyDelete |

### `/api/v1/expense-categories` — [backend/src/payments/expenses/expense-categories.controller.ts](backend/src/payments/expenses/expense-categories.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/expense-categories` | list |
| POST | `/api/v1/expense-categories` | create |
| PATCH | `/api/v1/expense-categories/:id` | update |
| DELETE | `/api/v1/expense-categories/:id` | deactivate |

### `/api/v1/invoices` — [backend/src/payments/invoices.controller.ts](backend/src/payments/invoices.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/invoices` | createInvoice |
| GET | `/api/v1/invoices` | findAll |
| GET | `/api/v1/invoices/:id` | findOne |
| PATCH | `/api/v1/invoices/:id/status` | updateStatus |
| POST | `/api/v1/invoices/:id/cancel` | cancel |

### `/api/v1/payments` — [backend/src/payments/payments.controller.ts](backend/src/payments/payments.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/payments/cash` | recordCash |
| POST | `/api/v1/payments/create-order` | createOrder |
| POST | `/api/v1/payments/verify` | verifyPayment |
| GET | `/api/v1/payments` | findAll |
| GET | `/api/v1/payments/:id/invoice` | getInvoice |
| GET | `/api/v1/payments/:id/pdf` | getInvoicePdf |
| POST | `/api/v1/payments/webhooks/razorpay` | razorpayWebhook |
| POST | `/api/v1/payments/webhooks/stripe` | stripeWebhook |

### `/api/v1/refunds` — [backend/src/payments/refunds.controller.ts](backend/src/payments/refunds.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/refunds` | processRefund |
| GET | `/api/v1/refunds` | findAll |
| GET | `/api/v1/refunds/:id` | findOne |

### `/api/v1/financial-reports` — [backend/src/payments/reports.controller.ts](backend/src/payments/reports.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/financial-reports/daily` | getDailyRevenue |
| GET | `/api/v1/financial-reports/monthly` | getMonthlyRevenue |
| GET | `/api/v1/financial-reports/dashboard` | getDashboardMetrics |
| GET | `/api/v1/financial-reports/membership-revenue` | getMembershipRevenue |
| GET | `/api/v1/financial-reports/ledger` | getFinancialLedger |

### `/api/v1/integrations` — [backend/src/platform/controllers/integrations.controller.ts](backend/src/platform/controllers/integrations.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/integrations/catalog` | getCatalog |
| GET | `/api/v1/integrations` | getIntegrations |
| GET | `/api/v1/integrations/:id` | getIntegration |
| POST | `/api/v1/integrations` | createIntegration |
| PATCH | `/api/v1/integrations/:id` | updateIntegration |
| PATCH | `/api/v1/integrations/:id/toggle` | toggleIntegration |
| POST | `/api/v1/integrations/:id/test` | testIntegration |
| DELETE | `/api/v1/integrations/:id` | deleteIntegration |

### `/api/v1/platform` — [backend/src/platform/controllers/platform.controller.ts](backend/src/platform/controllers/platform.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/platform/overview` | getOverview |
| GET | `/api/v1/platform/feature-flags` | getFeatureFlags |
| GET | `/api/v1/platform/feature-flags/:key` | getFeatureFlag |
| GET | `/api/v1/platform/feature-flags/:key/enabled` | isFeatureEnabled |
| POST | `/api/v1/platform/feature-flags` | createFeatureFlag |
| PATCH | `/api/v1/platform/feature-flags/:key` | updateFeatureFlag |
| POST | `/api/v1/platform/feature-flags/bulk-toggle` | bulkToggleFlags |
| DELETE | `/api/v1/platform/feature-flags/:key` | deleteFeatureFlag |
| GET | `/api/v1/platform/white-label` | getWhiteLabelConfig |
| PATCH | `/api/v1/platform/white-label` | updateWhiteLabelConfig |
| GET | `/api/v1/platform/sso-providers` | getSsoProviders |
| GET | `/api/v1/platform/sso-providers/:id` | getSsoProvider |
| POST | `/api/v1/platform/sso-providers` | createSsoProvider |
| PATCH | `/api/v1/platform/sso-providers/:id` | updateSsoProvider |
| DELETE | `/api/v1/platform/sso-providers/:id` | deleteSsoProvider |
| GET | `/api/v1/platform/notifications` | getNotifications |
| GET | `/api/v1/platform/notifications/unread-count` | getUnreadCount |
| POST | `/api/v1/platform/notifications` | createNotification |
| PATCH | `/api/v1/platform/notifications/:id/read` | markAsRead |
| POST | `/api/v1/platform/notifications/mark-all-read` | markAllAsRead |

### `/api/v1/webhooks` — [backend/src/platform/controllers/webhooks.controller.ts](backend/src/platform/controllers/webhooks.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/webhooks/events` | getSupportedEvents |
| GET | `/api/v1/webhooks` | getWebhooks |
| GET | `/api/v1/webhooks/:id` | getWebhook |
| POST | `/api/v1/webhooks` | createWebhook |
| PATCH | `/api/v1/webhooks/:id` | updateWebhook |
| DELETE | `/api/v1/webhooks/:id` | deleteWebhook |
| POST | `/api/v1/webhooks/:id/rotate-secret` | rotateSecret |
| GET | `/api/v1/webhooks/:id/deliveries` | getDeliveries |
| POST | `/api/v1/webhooks/deliveries/:deliveryId/retry` | retryDelivery |

### `/api/v1/admin/member-referrals` — [backend/src/referrals/member-referrals-admin.controller.ts](backend/src/referrals/member-referrals-admin.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/admin/member-referrals/overview` | getOverview |
| GET | `/api/v1/admin/member-referrals/programs` | listPrograms |
| POST | `/api/v1/admin/member-referrals/programs` | createProgram |
| PATCH | `/api/v1/admin/member-referrals/programs/:id` | updateProgram |
| POST | `/api/v1/admin/member-referrals/programs/:id/status` | setStatus |
| POST | `/api/v1/admin/member-referrals/:id/manual-reward` | manualReward |
| POST | `/api/v1/admin/member-referrals/rewards/:id/revoke` | revokeReward |
| POST | `/api/v1/admin/member-referrals/:id/force-transition` | forceTransition |
| GET | `/api/v1/admin/member-referrals/fraud-queue` | listFraudQueue |
| POST | `/api/v1/admin/member-referrals/fraud-signals/:id/review` | reviewSignal |

### `/api/v1/member-referrals` — [backend/src/referrals/member-referrals.controller.ts](backend/src/referrals/member-referrals.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/member-referrals/validate` | validate |
| POST | `/api/v1/member-referrals` | create |
| GET | `/api/v1/member-referrals/me/stats` | getMyStats |
| GET | `/api/v1/member-referrals/leaderboard` | getLeaderboard |
| POST | `/api/v1/member-referrals/:member_id/ensure-code` | ensureCode |

### `/api/v1/admin/referrals/analytics` — [backend/src/referrals/referral-analytics.controller.ts](backend/src/referrals/referral-analytics.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/admin/referrals/analytics/funnel` | funnel |
| GET | `/api/v1/admin/referrals/analytics/top-referrers` | topReferrers |
| GET | `/api/v1/admin/referrals/analytics/attributed-revenue` | attributedRevenue |
| GET | `/api/v1/admin/referrals/analytics/time-to-reward` | timeToReward |
| GET | `/api/v1/admin/referrals/analytics/wallet-aggregates` | walletAggregates |
| GET | `/api/v1/admin/referrals/analytics/daily-trend` | dailyTrend |
| POST | `/api/v1/admin/referrals/analytics/redemption/quote` | quote |
| POST | `/api/v1/admin/referrals/analytics/redemption/apply` | apply |
| POST | `/api/v1/admin/referrals/analytics/redemption/:entry_id/reverse` | reverse |
| GET | `/api/v1/admin/referrals/analytics/funnel` | funnel |
| GET | `/api/v1/admin/referrals/analytics/leaderboard` | leaderboard |
| GET | `/api/v1/admin/referrals/analytics/reward-costs` | rewardCosts |
| GET | `/api/v1/admin/referrals/analytics/:member_id` | dashboard |

### `/api/v1/admin/referrals` — [backend/src/referrals/referrals-admin.controller.ts](backend/src/referrals/referrals-admin.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/admin/referrals/campaigns` | listCampaigns |
| POST | `/api/v1/admin/referrals/campaigns` | createCampaign |
| PATCH | `/api/v1/admin/referrals/campaigns/:id` | updateCampaign |
| GET | `/api/v1/admin/referrals/rules` | listRules |
| GET | `/api/v1/admin/referrals/rules/:id` | getRule |
| POST | `/api/v1/admin/referrals/rules` | createRule |
| PATCH | `/api/v1/admin/referrals/rules/:id` | updateRule |
| DELETE | `/api/v1/admin/referrals/rules/:id` | deleteRule |
| GET | `/api/v1/admin/referrals/analytics` | getAnalytics |
| GET | `/api/v1/admin/referrals` | listAllReferrals |
| GET | `/api/v1/admin/referrals/reward-logs` | getRewardLogs |
| GET | `/api/v1/admin/referrals/overview` | getOverview |
| GET | `/api/v1/admin/referrals/fraud-queue` | listFraudQueue |
| POST | `/api/v1/admin/referrals/fraud-signals/:id/review` | reviewSignal |
| GET | `/api/v1/admin/referrals/:id/lifecycle` | getLifecycle |
| POST | `/api/v1/admin/referrals/:id/force-transition` | forceTransition |
| POST | `/api/v1/admin/referrals/reward-logs/:id/revoke` | revokeReward |
| GET | `/api/v1/admin/referrals/wallets/:studio_id` | getWallet |
| POST | `/api/v1/admin/referrals/wallets/:studio_id/freeze` | freezeWallet |
| POST | `/api/v1/admin/referrals/wallets/:studio_id/unfreeze` | unfreezeWallet |
| POST | `/api/v1/admin/referrals/wallets/manual-adjustment` | manualAdjustment |
| POST | `/api/v1/admin/referrals/:id/recompute-risk` | recomputeRisk |

### `/api/v1/internal/referrals` — [backend/src/referrals/referrals-internal.controller.ts](backend/src/referrals/referrals-internal.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/internal/referrals/overview` | overview |
| GET | `/api/v1/internal/referrals/analytics/funnel` | funnel |
| GET | `/api/v1/internal/referrals/analytics/top-referrers` | topReferrers |
| GET | `/api/v1/internal/referrals/analytics/attributed-revenue` | attributedRevenue |
| GET | `/api/v1/internal/referrals/analytics/time-to-reward` | timeToReward |
| GET | `/api/v1/internal/referrals/analytics/wallet-aggregates` | walletAggregates |
| GET | `/api/v1/internal/referrals/analytics/daily-trend` | dailyTrend |
| GET | `/api/v1/internal/referrals/fraud-queue` | fraudQueue |
| POST | `/api/v1/internal/referrals/fraud-signals/:id/review` | reviewSignal |
| GET | `/api/v1/internal/referrals/wallets/:studio_id` | wallet_ |
| POST | `/api/v1/internal/referrals/wallets/:studio_id/freeze` | freezeWallet |
| POST | `/api/v1/internal/referrals/wallets/:studio_id/unfreeze` | unfreezeWallet |
| POST | `/api/v1/internal/referrals/wallets/manual-adjustment` | manualAdjustment |
| GET | `/api/v1/internal/referrals/plans` | listPlans |
| GET | `/api/v1/internal/referrals/rules` | listRules |
| GET | `/api/v1/internal/referrals/rules/:id` | getRule |
| POST | `/api/v1/internal/referrals/rules` | createRule |
| PATCH | `/api/v1/internal/referrals/rules/:id` | updateRule |
| DELETE | `/api/v1/internal/referrals/rules/:id` | deleteRule |
| GET | `/api/v1/internal/referrals/campaigns` | listCampaigns |
| POST | `/api/v1/internal/referrals/campaigns` | createCampaign |

### `/api/v1/referrals` — [backend/src/referrals/referrals.controller.ts](backend/src/referrals/referrals.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/referrals/validate` | validateCode |
| POST | `/api/v1/referrals` | createReferral |
| GET | `/api/v1/referrals/stats` | getStats |
| POST | `/api/v1/referrals/events/subscription-activated` | subscriptionActivated |

### `/api/v1/roles` — [backend/src/roles/roles.controller.ts](backend/src/roles/roles.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/roles` | findAll |
| GET | `/api/v1/roles/permissions` | getPermissionModules |
| GET | `/api/v1/roles/:id` | findOne |
| POST | `/api/v1/roles` | create |
| PATCH | `/api/v1/roles/:id` | update |
| DELETE | `/api/v1/roles/:id` | remove |

### `/api/v1/search` — [backend/src/search/search.controller.ts](backend/src/search/search.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/search` | globalSearch |
| POST | `/api/v1/search/reindex/:indexName` | reindex |

### `/api/v1/settings` — [backend/src/settings/settings.controller.ts](backend/src/settings/settings.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/settings/studio` | getStudio |
| GET | `/api/v1/settings/account` | getAccountOverview |
| GET | `/api/v1/settings/invoices` | getInvoices |
| GET | `/api/v1/settings/branches-summary` | getBranchSummary |
| GET | `/api/v1/settings/plans` | getAvailablePlans |
| PATCH | `/api/v1/settings/studio` | updateStudio |
| GET | `/api/v1/settings/referral` | getReferralSettings |
| PATCH | `/api/v1/settings/referral` | updateReferralSettings |
| PATCH | `/api/v1/settings/subscription` | changePlan |
| DELETE | `/api/v1/settings/clear-data` | clearTenantData |

### `/api/v1/payroll` — [backend/src/staff/payroll.controller.ts](backend/src/staff/payroll.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/payroll/config/:staffId` | getConfig |
| POST | `/api/v1/payroll/config` | upsertConfig |
| GET | `/api/v1/payroll/summary` | getPayrollSummary |
| POST | `/api/v1/payroll/process` | processPayroll |
| GET | `/api/v1/payroll/records` | getPayrollRecords |
| PATCH | `/api/v1/payroll/records/:id` | updatePayrollRecord |
| GET | `/api/v1/payroll/revenue` | getRevenueReport |

### `/api/v1/staff/biometric` — [backend/src/staff/staff-biometrics.controller.ts](backend/src/staff/staff-biometrics.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/staff/biometric/enrollments` | listAll |
| GET | `/api/v1/staff/biometric/staff/:id` | listForStaff |
| POST | `/api/v1/staff/biometric/enroll` | enroll |
| DELETE | `/api/v1/staff/biometric/enrollments/:id` | revoke |
| POST | `/api/v1/staff/biometric/clock-face` | clockFace |
| POST | `/api/v1/staff/biometric/clock-manual` | clockManual |

### `/api/v1/staff` — [backend/src/staff/staff.controller.ts](backend/src/staff/staff.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/staff/invites` | listInvites |
| POST | `/api/v1/staff/invites/:id/resend` | resendInvite |
| DELETE | `/api/v1/staff/invites/:id` | revokeInvite |
| POST | `/api/v1/staff/attendance/check-in` | recordCheckIn |
| PATCH | `/api/v1/staff/attendance/:attendanceId/check-out` | recordCheckOut |
| POST | `/api/v1/staff/shifts` | createShift |
| GET | `/api/v1/staff/shifts` | getShifts |
| PATCH | `/api/v1/staff/shifts/:id` | updateShift |
| DELETE | `/api/v1/staff/shifts/:id` | deleteShift |
| POST | `/api/v1/staff/leaves` | createLeaveRequest |
| GET | `/api/v1/staff/leaves` | getLeaveRequests |
| PATCH | `/api/v1/staff/leaves/:id/review` | reviewLeaveRequest |
| POST | `/api/v1/staff/leaves/:id/cancel` | cancelLeaveRequest |
| GET | `/api/v1/staff` | findAll |
| POST | `/api/v1/staff` | create |
| GET | `/api/v1/staff/:id` | findOne |
| PATCH | `/api/v1/staff/:id` | update |
| DELETE | `/api/v1/staff/:id` | deactivate |
| GET | `/api/v1/staff/:id/profile` | getProfile |
| PATCH | `/api/v1/staff/:id/profile` | updateProfile |
| GET | `/api/v1/staff/:id/availability` | getAvailability |
| POST | `/api/v1/staff/:id/availability` | setAvailability |
| GET | `/api/v1/staff/:id/attendance` | getAttendance |
| PATCH | `/api/v1/staff/:id/branch-access` | updateBranchAccess |
| POST | `/api/v1/staff/:id/invite` | sendInvite |
| GET | `/api/v1/staff/:id/permissions` | getPermissionOverrides |
| PUT | `/api/v1/staff/:id/permissions` | updatePermissionOverrides |
| POST | `/api/v1/staff/:id/reset-password` | resetPassword |
| DELETE | `/api/v1/staff/:id/access` | revokeAllAccess |
| GET | `/api/v1/staff/:token` | getInviteByToken |
| POST | `/api/v1/staff/accept` | acceptInvite |

### `/api/v1/trainer` — [backend/src/staff/trainer.controller.ts](backend/src/staff/trainer.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/trainer/assign-client` | assignClient |
| GET | `/api/v1/trainer/:id/clients` | getClients |
| PATCH | `/api/v1/trainer/clients/:assignmentId` | updateClientAssignment |
| POST | `/api/v1/trainer/sessions` | createSession |
| GET | `/api/v1/trainer/sessions` | getSessions |
| PATCH | `/api/v1/trainer/sessions/:id` | updateSession |
| GET | `/api/v1/trainer/performance` | getPerformance |
| GET | `/api/v1/trainer/:id/dashboard` | getDashboard |
| POST | `/api/v1/trainer/:id/performance-snapshot` | recordPerformanceSnapshot |
| GET | `/api/v1/trainer/:id/performance-history` | getPerformanceHistory |

### `/api/v1/subscription` — [backend/src/subscription/subscription.controller.ts](backend/src/subscription/subscription.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/subscription/status` | getStatus |
| GET | `/api/v1/subscription/events` | getEvents |
| GET | `/api/v1/subscription/renewal-preview` | preview |
| POST | `/api/v1/subscription/renew` | renew |
| GET | `/api/v1/subscription/invoices` | listInvoices |
| GET | `/api/v1/subscription/invoices/:id` | getInvoice |
| GET | `/api/v1/subscription/invoices/:id/pdf` | getInvoicePdf |
| POST | `/api/v1/subscription/cancel` | cancel |
| POST | `/api/v1/subscription/admin/:studioId/lifecycle` | setLifecycle |

### `/api/v1/uploads` — [backend/src/uploads/uploads.controller.ts](backend/src/uploads/uploads.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/api/v1/uploads/photo` | if |

### `/api/v1` — [backend/src/wallet/wallet.controller.ts](backend/src/wallet/wallet.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/api/v1/members/:memberId/wallet` | getWallet |
| GET | `/api/v1/members/:memberId/wallet/transactions` | getTransactions |
| POST | `/api/v1/wallet/topup` | topUp |
| POST | `/api/v1/wallet/adjust` | adjust |
| GET | `/api/v1/loyalty/config` | getConfig |
| PUT | `/api/v1/loyalty/config` | upsertConfig |


## Member BFF API (member JWT)

### `/member/v1/auth` — [backend/src/member/auth/member-auth.controller.ts](backend/src/member/auth/member-auth.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/member/v1/auth/otp/request` | requestOtp |
| POST | `/member/v1/auth/session` | session |
| POST | `/member/v1/auth/refresh` | refresh |
| POST | `/member/v1/auth/dev/session` | devSession |

### `/member/v1` — [backend/src/member/data/member-chat.controller.ts](backend/src/member/data/member-chat.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/member/v1/trainer-chat/threads` | threads |
| GET | `/member/v1/trainer-chat/threads/:trainerId/messages` | messages |
| POST | `/member/v1/trainer-chat/threads/:trainerId/messages` | send |

### `/member/v1` — [backend/src/member/data/member-checkin.controller.ts](backend/src/member/data/member-checkin.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/member/v1/checkins` | checkIn |

### `/member/v1` — [backend/src/member/data/member-class.controller.ts](backend/src/member/data/member-class.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/member/v1/classes` | list |
| POST | `/member/v1/classes/:classId/book` | book |
| DELETE | `/member/v1/classes/:classId/booking` | cancel |

### `/member/v1` — [backend/src/member/data/member-community.controller.ts](backend/src/member/data/member-community.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/member/v1/community/leaderboard` | leaderboard |
| GET | `/member/v1/community/challenges` | challenges |
| POST | `/member/v1/community/challenges/:challengeId/join` | join |
| GET | `/member/v1/community/badges` | badges |

### `/member/v1` — [backend/src/member/data/member-core.controller.ts](backend/src/member/data/member-core.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/member/v1/me` | me |
| GET | `/member/v1/home` | home |
| GET | `/member/v1/gym/occupancy` | occupancy |
| GET | `/member/v1/gym/locations` | locations |
| GET | `/member/v1/membership` | membership |
| GET | `/member/v1/progress` | progress |
| POST | `/member/v1/progress/metrics` | addMetric |

### `/member/v1` — [backend/src/member/data/member-exercise.controller.ts](backend/src/member/data/member-exercise.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/member/v1/exercises` | list |
| GET | `/member/v1/exercises/:exerciseId` | detail |
| PUT | `/member/v1/exercises/:exerciseId/favorite` | favorite |
| DELETE | `/member/v1/exercises/:exerciseId/favorite` | unfavorite |

### `/member/v1` — [backend/src/member/data/member-health.controller.ts](backend/src/member/data/member-health.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/member/v1/health/samples` | ingest |
| GET | `/member/v1/health/summary` | summary |
| GET | `/member/v1/health/connections` | connections |
| POST | `/member/v1/health/connections` | connect |
| DELETE | `/member/v1/health/connections/:provider` | revoke |

### `/member/v1` — [backend/src/member/data/member-notification.controller.ts](backend/src/member/data/member-notification.controller.ts)

| Method | Path | Handler |
|---|---|---|
| POST | `/member/v1/notifications/device-tokens` | register |
| DELETE | `/member/v1/notifications/device-tokens` | unregister |

### `/member/v1` — [backend/src/member/data/member-nutrition.controller.ts](backend/src/member/data/member-nutrition.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/member/v1/nutrition/today` | today |
| GET | `/member/v1/nutrition/foods` | foods |
| POST | `/member/v1/nutrition/meals` | logMeal |
| POST | `/member/v1/nutrition/water` | logWater |
| PUT | `/member/v1/nutrition/goal` | setGoal |

### `/member/v1` — [backend/src/member/data/member-workout.controller.ts](backend/src/member/data/member-workout.controller.ts)

| Method | Path | Handler |
|---|---|---|
| GET | `/member/v1/workouts/today` | today |
| POST | `/member/v1/workouts/:workoutId/logs` | log |

