# Project Memory

> Updated: 2026-04-10

## Architecture
- **Frontend:** Next.js 14 (App Router) + Tailwind + shadcn/ui
- **Backend:** NestJS 10 + Prisma 5 + class-validator
- **Database:** Supabase PostgreSQL — multi-tenant (schema-per-studio: `studio_{id}`)
- **Auth:** JWT + Passport, RBAC with roles (owner, admin, trainer, staff, member)
- **Infra:** Vercel (web) + Railway (API) + Upstash Redis + Supabase Storage

## Key Modules
| Module | Status | Notes |
|--------|--------|-------|
| Auth (login/register/JWT/RBAC) | Built | SSO, 2FA, API key support |
| Members | Built | CRUD, plans, profiles |
| Check-ins | Built | QR + manual; facial recognition planned |
| Payments | Built | Razorpay + Stripe + manual |
| Classes & Schedule | Built | CRUD, booking, attendance, waitlist |
| Branches | Built | Multi-branch support |
| Staff | Built | Directory, shifts, leave |
| Dashboard/Analytics | Built | KPIs, reports |
| AI Advisor | Built | Claude API chat |
| Marketing | Planned | Campaigns, automation, referrals |
| Settings | Partial | Studio settings, integrations |

## Known Issues
- Tenant schema seeding incomplete — 17 API failures traced to empty schemas (2026-03-24)
- RFID check-in: greyed out "Coming Soon" per TRD
- Member Goals section: not in TRD — skip

## Key Decisions
- snake_case for all DB fields and API payloads
- UUIDs for all PKs
- TRD is single source of truth over UI screens
- No PayPal — use Razorpay (India) + Stripe (international)
- Anthropic Claude for AI, not OpenAI
- Resend for email, not SendGrid
- face_descriptor field is write-only (never returned in API)

## Constraints
- Multi-tenant: every query scoped by studio_id via TenantMiddleware
- All Supabase buckets private — signed URLs only (1hr expiry)
- Max 5 failed logins -> 15min lockout (Redis TTL)
- salary field: visible only to owner role
