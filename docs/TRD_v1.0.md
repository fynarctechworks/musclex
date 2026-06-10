⚙️

**MUSCLEX**

Technical Requirements Document

TRD v1.0 \| Vibe Coding Edition \| 2025

  ----------------------------- -----------------------------------------
  **Attribute**                 **Value**

  PRD Reference                 MuscleX PRD v1.0

  Build Priority                Web → iOS/Android

  Multi-tenancy                 Separate Supabase schema per studio

  Facial Recognition            On-device via face-api.js (no cloud)

  RFID (Phase 1)                Skipped --- QR + Manual only

  WhatsApp                      Meta WhatsApp Cloud API (free tier)

  Offline Mode                  Basic --- check-in queue only

  Budget (Phase 1)              Free tiers; scale to \$500/mo on client
                                growth
  ----------------------------- -----------------------------------------

**📊 Section 1: Document Overview**

This Technical Requirements Document (TRD) is the engineering blueprint
for MuscleX. It is written to be AI-coding-tool friendly --- every
table name, field name, API endpoint, and library is specified exactly
so that Claude, Cursor, v0.dev, and Bolt can implement directly without
ambiguity.

> **Audience:** AI coding assistants (Claude, Cursor, Bolt, v0.dev) +
> solo developer. No implementation code here --- specs only. AI
> generates the code from these specs.

**1.1 Scope Summary**

  ---------------------- ------------------------------------------------
  **Scope Item**         **Decision**

  Phase 1 Focus          Web app (Next.js) --- full feature set

  Phase 2 Focus          React Native (Expo) iOS + Android --- feature
                         parity

  Backend                NestJS (Node.js/TypeScript) on Railway

  Database               Supabase PostgreSQL --- 1 schema per studio
                         tenant

  Real-time              Supabase Realtime (built-in) + Socket.io for
                         check-in feed

  Auth                   Supabase Auth (JWT) + custom RBAC middleware

  AI                     Anthropic Claude API (claude-sonnet-4-20250514)

  Payments               Razorpay (India primary) + Stripe
                         (international)

  SMS                    Twilio SMS (existing account)

  WhatsApp               Meta WhatsApp Cloud API (free: 1,000 msgs/month)

  Email                  Resend.com (3,000 free emails/month)

  Job Queues             BullMQ + Upstash Redis (free tier)

  Facial Recognition     face-api.js (on-device TensorFlow.js) --- zero
                         cloud cost

  Offline (Phase 1)      IndexedDB queue for check-ins only; sync on
                         reconnect

  Hosting --- Web        Vercel (free tier --- Hobby plan)

  Hosting --- API        Railway (\$5/month Starter after free trial)

  File Storage           Supabase Storage (1GB free)

  Monitoring             Sentry (free 5k errors/month) + Posthog (free 1M
                         events)
  ---------------------- ------------------------------------------------

**🏗️ Section 2: System Architecture**

**2.1 Architecture Diagram (Text)**

> CLIENT LAYER
>
> \[Next.js Web App --- Vercel\] \[React Native Expo --- iOS/Android\]
> (Phase 2)
>
> \| \|
>
> └──────────────────┬─────────────────────┘
>
> \| HTTPS / WSS
>
> ▼
>
> API LAYER
>
> \[NestJS REST API --- Railway\]
>
> \|── Auth Guard (JWT + RBAC)
>
> \|── Tenant Resolver Middleware (schema routing)
>
> \|── BullMQ Job Queues (scheduled tasks)
>
> \|── Socket.io Gateway (real-time events)
>
> \|
>
> ┌───────────────┼──────────────────┐
>
> ▼ ▼ ▼
>
> DATA / AI LAYER
>
> \[Supabase PostgreSQL\] \[Upstash Redis\] \[Supabase Storage\]
>
> schema per studio BullMQ queues Photos / PDFs
>
> Supabase Auth Rate limiting
>
> Supabase Realtime
>
> \|
>
> ▼
>
> EXTERNAL SERVICES
>
> \[Anthropic Claude API\] --- AI Advisor
>
> \[Razorpay / Stripe\] --- Payments
>
> \[Twilio SMS\] --- SMS reminders (existing account)
>
> \[Meta WhatsApp API\] --- WhatsApp messages
>
> \[Resend.com\] --- Transactional email
>
> \[face-api.js\] --- On-device facial recognition (no API call)

**2.2 Multi-Tenancy Architecture**

> **Pattern:** Separate PostgreSQL schema per studio inside one Supabase
> project. Studio ID maps to schema name. RLS (Row Level Security)
> enforces isolation.

  ---------------------- ------------------------------------------------
  **Schema**             **Contents**

  public                 Global tables: studios, subscriptions, users
                         (Supabase Auth)

  studio\_{studio_id}    All per-studio tables: members, payments,
                         check_ins, classes, etc.
  ---------------------- ------------------------------------------------

-   Schema created automatically when a new studio signs up (via
    Supabase Edge Function)

-   Tenant Resolver Middleware in NestJS reads studio_id from JWT, sets
    PostgreSQL search_path to studio\_{studio_id}

-   No cross-schema queries ever --- one NestJS service instance handles
    all schemas via dynamic connection string

-   Supabase RLS policies on public schema prevent studios from reading
    each other\'s data

**2.3 Real-Time Data Flow (Check-In)**

1.  Front-desk tablet scans QR code via browser camera

2.  Web app decodes QR → extracts member_id → calls POST /check-ins

3.  NestJS validates membership, logs check-in in studio schema

4.  Supabase Realtime publishes event on channel
    studio\_{studio_id}:checkins

5.  Owner dashboard receives event via WebSocket → updates KPI +
    activity feed instantly

6.  If offline: check-in stored in IndexedDB with status: \"pending\" →
    background sync worker retries every 30s

**🛠️ Section 3: Technology Stack**

**3.1 Full Stack Table**

  -------------------- ----------------------------- ---------------- --------------------
  **Layer**            **Technology / Package**      **Version**      **Why This Choice**

  **FRONTEND --- WEB**                                                

  Framework            next                          14.x (App        SSR + API routes;
                                                     Router)          best AI code gen
                                                                      support

  UI Components        shadcn/ui                     latest           Pre-built,
                                                                      accessible,
                                                                      Tailwind-based

  Styling              tailwindcss                   3.x              Utility-first; works
                                                                      perfectly with
                                                                      shadcn

  State Management     zustand                       4.x              Lightweight; easy
                                                                      for AI to generate

  Charts               recharts                      2.x              React-native
                                                                      compatible; wide AI
                                                                      knowledge

  Calendar / Schedule  \@fullcalendar/react          6.x              Drag-drop,
                                                                      week/month views
                                                                      built-in

  Date Handling        date-fns                      3.x              Tree-shakeable; no
                                                                      moment.js bloat

  Forms                react-hook-form + zod         7.x + 3.x        Validation +
                                                                      TypeScript types
                                                                      from same schema

  Data Fetching        \@tanstack/react-query        5.x              Caching, refetch,
                                                                      optimistic updates

  QR Scanner           html5-qrcode                  2.x              Browser camera QR
                                                                      scan; no install
                                                                      needed

  QR Generator         qrcode.react                  3.x              Renders QR as
                                                                      SVG/Canvas in React

  Facial Recognition   face-api.js                   0.22.x           On-device
                                                                      TensorFlow.js ---
                                                                      free, private

  PDF Generation       \@react-pdf/renderer          3.x              React-style
                                                                      invoice/report PDF
                                                                      generation

  Offline Queue        idb (IndexedDB wrapper)       8.x              Stores pending
                                                                      check-ins when
                                                                      offline

  Toast / Alerts       sonner                        1.x              Modern, minimal
                                                                      toast notifications

  Icons                lucide-react                  0.x              Consistent stroke
                                                                      style; used by
                                                                      shadcn

  Data Tables          \@tanstack/react-table        8.x              Headless; pair with
                                                                      shadcn Table
                                                                      component

  Supabase Client      \@supabase/supabase-js        2.x              Realtime
                                                                      subscriptions +
                                                                      auth + storage

  **BACKEND --- API**                                                 

  Framework            \@nestjs/core                 10.x             Modular,
                                                                      TypeScript-native,
                                                                      decorator-based

  ORM                  \@prisma/client + prisma      5.x              Type-safe queries;
                                                                      great AI code gen

  Validation           class-validator +             0.14.x           DTO validation in
                       class-transformer                              NestJS pipes

  WebSocket            \@nestjs/websockets +         4.x              Real-time check-in
                       socket.io                                      feed to dashboard

  Job Queues           \@nestjs/bullmq + bullmq      10.x             Renewal reminders,
                                                                      campaign dispatch

  Scheduled Tasks      \@nestjs/schedule             4.x              Daily churn scoring,
                                                                      AI briefing at 8 AM

  Auth JWT             \@nestjs/jwt +                10.x             JWT decode + guard
                       \@nestjs/passport                              decorators

  Config               \@nestjs/config               3.x              Environment variable
                                                                      management

  File Upload          \@nestjs/platform-express +   10.x             Profile photo upload
                       multer                                         handling

  HTTP Client          \@nestjs/axios                3.x              External API calls
                                                                      (WhatsApp, Razorpay)

  **EXTERNAL SDKS**                                                   

  Razorpay             razorpay                      2.x              India-first payment
                                                                      gateway

  Stripe               stripe                        14.x             International
                                                                      payments

  Twilio SMS           twilio                        5.x              SMS reminders
                                                                      (existing account)

  Email                resend                        3.x              3,000 free
                                                                      emails/month; React
                                                                      Email templates

  Claude AI            \@anthropic-ai/sdk            0.x              AI Business Advisor

  PDF Server           \@react-pdf/renderer (server) 3.x              Invoice PDF
                                                                      generation on
                                                                      backend

  **INFRASTRUCTURE**                                                  

  Web Hosting          Vercel                        ---              Free Hobby tier;
                                                                      zero-config Next.js
                                                                      deploy

  API Hosting          Railway                       ---              \$5/mo Starter;
                                                                      Docker-ready NestJS

  Database             Supabase                      ---              Free: 500MB DB, 1GB
                                                                      storage, 50k MAU

  Redis / Queues       Upstash Redis                 ---              Free: 10k req/day;
                                                                      BullMQ compatible

  Error Monitoring     Sentry                        ---              Free: 5,000
                                                                      errors/month

  Analytics            Posthog                       ---              Free: 1M
                                                                      events/month
  -------------------- ----------------------------- ---------------- --------------------

**🗄️ Section 4: Database Schema**

> **Critical Rule:** All field names below are EXACT. AI coding tools
> must use these verbatim. snake_case throughout. UUIDs for all primary
> keys. All tables include created_at and updated_at.

**4.1 Public Schema (Shared --- Tenant Registry)**

**Table: public.studios**

  --------------------- ------------- ------------------- -------------------------
  **Column**            **Type**      **Constraints**     **Description**

  id                    uuid          PK, default         Unique studio identifier
                                      gen_random_uuid()   

  name                  text          NOT NULL            Studio business name

  slug                  text          UNIQUE, NOT NULL    URL-safe identifier e.g.
                                                          priya-yoga

  schema_name           text          UNIQUE, NOT NULL    studio\_{id} ---
                                                          PostgreSQL schema name

  owner_user_id         uuid          FK → auth.users     Supabase Auth user ID of
                                                          owner

  logo_url              text          NULLABLE            Supabase Storage URL

  timezone              text          DEFAULT             IANA timezone string
                                      \"Asia/Kolkata\"    

  currency              text          DEFAULT \"INR\"     ISO 4217 currency code

  subscription_plan     text          DEFAULT \"free\"    free \| starter \| pro \|
                                                          enterprise

  subscription_status   text          DEFAULT \"trial\"   trial \| active \|
                                                          past_due \| cancelled

  trial_ends_at         timestamptz   NULLABLE            Trial expiry timestamp

  created_at            timestamptz   DEFAULT now()       

  updated_at            timestamptz   DEFAULT now()       
  --------------------- ------------- ------------------- -------------------------

**4.2 Per-Studio Schema (studio\_{studio_id})**

> **Note:** All tables below live inside the dynamic studio schema. The
> NestJS Tenant Resolver sets search_path = studio\_{studio_id} so
> queries need no schema prefix.

**Table: branches**

  ------------------ ------------- ----------------- -------------------------
  **Column**         **Type**      **Constraints**   **Description**

  id                 uuid          PK                Branch identifier

  name               text          NOT NULL          Branch display name

  address            text          NULLABLE          Full street address

  city               text          NULLABLE          City name

  phone              text          NULLABLE          Branch contact number

  email              text          NULLABLE          Branch contact email

  is_active          boolean       DEFAULT true      Soft-disable branch

  created_at         timestamptz   DEFAULT now()     

  updated_at         timestamptz   DEFAULT now()     
  ------------------ ------------- ----------------- -------------------------

**Table: members**

  ------------------------- ------------- ----------------- -------------------------
  **Column**                **Type**      **Constraints**   **Description**

  id                        uuid          PK                Member identifier

  member_code               text          UNIQUE, NOT NULL  Format: FS-YYYYMMDD-XXXX

  branch_id                 uuid          FK → branches.id  Primary branch assignment

  full_name                 text          NOT NULL          Full display name

  phone                     text          NOT NULL          Primary contact ---
                                                            mandatory

  email                     text          NULLABLE          Optional email address

  date_of_birth             date          NULLABLE          For birthday automation

  emergency_contact_name    text          NULLABLE          

  emergency_contact_phone   text          NULLABLE          

  profile_photo_url         text          NULLABLE          Supabase Storage URL

  face_descriptor           float8\[\]    NULLABLE          face-api.js 128-dim face
                                                            descriptor array

  checkin_method            text          DEFAULT           qr \| manual \| facial
                                          \"manual\"        

  qr_code                   text          UNIQUE, NULLABLE  UUID-based QR payload
                                                            string

  status                    text          DEFAULT           active \| expiring_soon
                                          \"active\"        \| expired \| frozen \|
                                                            inactive

  engagement_score          integer       DEFAULT 0         0--100, recalculated
                                                            daily

  churn_risk                text          DEFAULT \"low\"   low \| medium \| high

  referral_code             text          UNIQUE, NULLABLE  Member\'s own referral
                                                            code

  referred_by_member_id     uuid          FK → members.id,  Who referred this member
                                          NULLABLE          

  notes                     text          NULLABLE          Staff internal notes

  created_at                timestamptz   DEFAULT now()     

  updated_at                timestamptz   DEFAULT now()     
  ------------------------- ------------- ----------------- -------------------------

**Table: membership_plans**

  ---------------------- --------------- ----------------- -------------------------
  **Column**             **Type**        **Constraints**   **Description**

  id                     uuid            PK                

  branch_id              uuid            FK → branches.id, NULL = global plan across
                                         NULLABLE          all branches

  name                   text            NOT NULL          e.g. \"Monthly
                                                           Unlimited\"

  description            text            NULLABLE          Plan details shown to
                                                           staff

  plan_type              text            NOT NULL          unlimited \| class_pack
                                                           \| day_pass

  duration_days          integer         NULLABLE          30, 90, 365 --- NULL for
                                                           class packs

  total_classes          integer         NULLABLE          For class_pack plans only

  max_classes_per_week   integer         NULLABLE          Weekly cap; NULL =
                                                           unlimited

  price                  numeric(10,2)   NOT NULL          Price in studio\'s
                                                           currency

  is_active              boolean         DEFAULT true      Soft-archive old plans

  auto_renew_enabled     boolean         DEFAULT false     Allow auto-renewal for
                                                           this plan

  created_at             timestamptz     DEFAULT now()     
  ---------------------- --------------- ----------------- -------------------------

**Table: member_memberships**

  ---------------------- ------------- --------------------- -------------------------
  **Column**             **Type**      **Constraints**       **Description**

  id                     uuid          PK                    

  member_id              uuid          FK → members.id       

  plan_id                uuid          FK →                  
                                       membership_plans.id   

  branch_id              uuid          FK → branches.id      Branch where plan was
                                                             purchased

  start_date             date          NOT NULL              Membership start

  end_date               date          NULLABLE              NULL for open-ended; set
                                                             for date-based plans

  classes_remaining      integer       NULLABLE              For class_pack ---
                                                             decremented on check-in

  status                 text          DEFAULT \"active\"    active \| frozen \|
                                                             expired \| cancelled

  freeze_start_date      date          NULLABLE              When freeze began

  freeze_end_date        date          NULLABLE              Freeze ends; end_date
                                                             extended by freeze
                                                             duration

  freeze_reason          text          NULLABLE              Medical / travel / other

  auto_renew             boolean       DEFAULT false         Auto-charge on expiry

  payment_method_token   text          NULLABLE              Razorpay/Stripe saved
                                                             token for auto-renew

  created_at             timestamptz   DEFAULT now()         

  updated_at             timestamptz   DEFAULT now()         
  ---------------------- ------------- --------------------- -------------------------

**Table: check_ins**

  ------------------ ------------- ----------------------- -------------------------
  **Column**         **Type**      **Constraints**         **Description**

  id                 uuid          PK                      

  member_id          uuid          FK → members.id         

  membership_id      uuid          FK →                    Which membership was used
                                   member_memberships.id   

  branch_id          uuid          FK → branches.id        Branch where check-in
                                                           occurred

  class_id           uuid          FK → classes.id,        NULL = open gym; set =
                                   NULLABLE                class check-in

  checkin_method     text          NOT NULL                qr \| manual \| facial

  checked_in_at      timestamptz   DEFAULT now()           Actual check-in time

  status             text          DEFAULT \"success\"     success \| failed \|
                                                           pending (offline queue)

  failure_reason     text          NULLABLE                expired \| no_credits \|
                                                           wrong_branch

  synced_at          timestamptz   NULLABLE                When offline record was
                                                           synced to server

  created_at         timestamptz   DEFAULT now()           
  ------------------ ------------- ----------------------- -------------------------

**Table: classes**

  ----------------------- ------------- ----------------- ----------------------------
  **Column**              **Type**      **Constraints**   **Description**

  id                      uuid          PK                

  branch_id               uuid          FK → branches.id  

  trainer_id              uuid          FK → staff.id     Primary trainer

  substitute_trainer_id   uuid          NULLABLE, FK →    Substitute if primary
                                        staff.id          unavailable

  name                    text          NOT NULL          Class name e.g. \"Morning
                                                          Vinyasa\"

  category                text          NOT NULL          yoga \| crossfit \| dance \|
                                                          hiit \| pilates \| other

  room                    text          NULLABLE          Room or area label

  capacity                integer       NOT NULL          Max participants

  duration_minutes        integer       NOT NULL          Class duration

  starts_at               timestamptz   NOT NULL          Scheduled start datetime

  recurrence_rule         text          NULLABLE          iCal RRULE string e.g.
                                                          FREQ=WEEKLY;BYDAY=MO,WE,FR

  recurrence_end_date     date          NULLABLE          When the recurrence series
                                                          ends

  status                  text          DEFAULT           scheduled \| in_progress \|
                                        \"scheduled\"     completed \| cancelled

  created_at              timestamptz   DEFAULT now()     
  ----------------------- ------------- ----------------- ----------------------------

**Table: class_enrollments**

  ------------------- ------------- ----------------- -------------------------
  **Column**          **Type**      **Constraints**   **Description**

  id                  uuid          PK                

  class_id            uuid          FK → classes.id   

  member_id           uuid          FK → members.id   

  status              text          DEFAULT           enrolled \| waitlisted \|
                                    \"enrolled\"      cancelled \| attended

  waitlist_position   integer       NULLABLE          NULL if not waitlisted; 1
                                                      = first in queue

  enrolled_at         timestamptz   DEFAULT now()     
  ------------------- ------------- ----------------- -------------------------

**Table: staff**

  ------------------- ------------- ----------------- -------------------------
  **Column**          **Type**      **Constraints**   **Description**

  id                  uuid          PK                

  user_id             uuid          FK → auth.users,  NULL until staff member
                                    NULLABLE          creates login

  branch_ids          uuid\[\]      NOT NULL          Array of assigned branch
                                                      IDs

  full_name           text          NOT NULL          

  role                text          NOT NULL          owner \| manager \|
                                                      trainer \| front_desk

  phone               text          NOT NULL          

  email               text          NULLABLE          

  specializations     text\[\]      NULLABLE          e.g. \[\"yoga\",
                                                      \"pilates\"\]

  performance_score   integer       DEFAULT 0         0--100 composite, updated
                                                      weekly

  is_active           boolean       DEFAULT true      

  joined_at           date          NULLABLE          Employment start date

  created_at          timestamptz   DEFAULT now()     
  ------------------- ------------- ----------------- -------------------------

**Table: payments**

  -------------------- --------------- ------------------------ -------------------------
  **Column**           **Type**        **Constraints**          **Description**

  id                   uuid            PK                       

  member_id            uuid            FK → members.id          

  membership_id        uuid            FK →                     NULL for non-membership
                                       member_memberships.id,   payments
                                       NULLABLE                 

  branch_id            uuid            FK → branches.id         

  amount               numeric(10,2)   NOT NULL                 Payment amount

  currency             text            DEFAULT \"INR\"          

  payment_method       text            NOT NULL                 cash \| card \| upi \|
                                                                bank_transfer \| razorpay
                                                                \| stripe

  status               text            DEFAULT \"pending\"      pending \| paid \|
                                                                partial \| failed \|
                                                                refunded

  gateway_payment_id   text            NULLABLE                 Razorpay/Stripe payment
                                                                ID

  gateway_order_id     text            NULLABLE                 Razorpay order ID

  receipt_number       text            UNIQUE                   Auto-generated:
                                                                RCP-YYYYMMDD-XXXX

  invoice_url          text            NULLABLE                 Supabase Storage URL for
                                                                PDF invoice

  notes                text            NULLABLE                 Staff notes on payment

  paid_at              timestamptz     NULLABLE                 Timestamp of confirmed
                                                                payment

  created_at           timestamptz     DEFAULT now()            
  -------------------- --------------- ------------------------ -------------------------

**Table: expenses**

  ---------------------- --------------- ----------------- -------------------------
  **Column**             **Type**        **Constraints**   **Description**

  id                     uuid            PK                

  branch_id              uuid            FK → branches.id  

  category               text            NOT NULL          salaries \| rent \|
                                                           equipment \| utilities \|
                                                           marketing \| maintenance
                                                           \| other

  description            text            NOT NULL          Free-text description

  amount                 numeric(10,2)   NOT NULL          

  currency               text            DEFAULT \"INR\"   

  expense_date           date            NOT NULL          Date expense was incurred

  receipt_url            text            NULLABLE          Photo of physical receipt

  recorded_by_staff_id   uuid            FK → staff.id     Who entered this expense

  created_at             timestamptz     DEFAULT now()     
  ---------------------- --------------- ----------------- -------------------------

**Table: notifications_log**

  --------------------- ------------- ----------------- -------------------------
  **Column**            **Type**      **Constraints**   **Description**

  id                    uuid          PK                

  member_id             uuid          FK → members.id,  NULL for system-wide
                                      NULLABLE          broadcasts

  channel               text          NOT NULL          sms \| whatsapp \| email
                                                        \| push

  trigger_type          text          NOT NULL          expiry_reminder \|
                                                        payment_receipt \|
                                                        inactivity \| birthday \|
                                                        campaign \| welcome

  message_body          text          NOT NULL          Actual message sent

  status                text          DEFAULT \"sent\"  sent \| delivered \|
                                                        failed

  external_message_id   text          NULLABLE          Twilio/Meta message SID
                                                        for tracking

  sent_at               timestamptz   DEFAULT now()     
  --------------------- ------------- ----------------- -------------------------

**Table: campaigns**

  --------------------- ------------- ----------------- -------------------------
  **Column**            **Type**      **Constraints**   **Description**

  id                    uuid          PK                

  name                  text          NOT NULL          Campaign name

  segment               text          NOT NULL          all \| expiring_soon \|
                                                        inactive \| by_plan \|
                                                        by_branch

  segment_filters       jsonb         NULLABLE          e.g. {\"plan_id\":
                                                        \"uuid\",
                                                        \"days_inactive\": 14}

  channels              text\[\]      NOT NULL          Array: \[\"whatsapp\",
                                                        \"email\"\]

  message_template      text          NOT NULL          Template with
                                                        {{member_name}}
                                                        placeholders

  status                text          DEFAULT \"draft\" draft \| scheduled \|
                                                        sending \| sent \| failed

  scheduled_at          timestamptz   NULLABLE          NULL = send immediately

  sent_count            integer       DEFAULT 0         Total sent

  delivered_count       integer       DEFAULT 0         Confirmed deliveries

  created_by_staff_id   uuid          FK → staff.id     

  created_at            timestamptz   DEFAULT now()     
  --------------------- ------------- ----------------- -------------------------

**Table: ai_conversations**

  ------------------ ------------- ----------------- -------------------------
  **Column**         **Type**      **Constraints**   **Description**

  id                 uuid          PK                

  staff_id           uuid          FK → staff.id     Who asked

  messages           jsonb         NOT NULL          Array of {role, content}
                                                     conversation history

  context_snapshot   jsonb         NULLABLE          Studio KPI data injected
                                                     as system context

  created_at         timestamptz   DEFAULT now()     

  updated_at         timestamptz   DEFAULT now()     
  ------------------ ------------- ----------------- -------------------------

**🔌 Section 5: API Design**

> **Base URL:** https://api.musclex.com/v1 --- All endpoints require
> Authorization: Bearer {jwt_token} header except /auth/\*
>
> **Tenant Resolution:** JWT payload contains studio_id. NestJS
> TenantMiddleware reads this, sets PostgreSQL search_path =
> studio\_{studio_id} before any query.

**5.1 Auth Endpoints**

  ------------ ----------------------- ---------------- ----------------- ----------------
  **Method**   **Endpoint**            **Purpose**      **Input**         **Output**

  POST         /auth/login             Owner/staff      {email, password} {access_token,
                                       login                              user, studio}

  POST         /auth/logout            Invalidate       ---               {success: true}
                                       session                            

  POST         /auth/refresh           Refresh JWT      {refresh_token}   {access_token}
                                       token                              

  POST         /auth/forgot-password   Send OTP to      {email}           {success: true}
                                       email                              

  POST         /auth/reset-password    Reset with OTP   {otp,             {success: true}
                                                        new_password}     
  ------------ ----------------------- ---------------- ----------------- ----------------

**5.2 Studio / Branch Endpoints**

  ------------ ------------------ --------------- ------------- -------------
  **Method**   **Endpoint**       **Purpose**     **Input**     **Output**

  GET          /studio            Get studio      ---           Studio object
                                  profile                       

  PATCH        /studio            Update studio   Partial       Updated
                                  settings        studio fields studio

  GET          /branches          List all        ---           Branch\[\]
                                  branches                      

  POST         /branches          Create branch   Branch fields Branch object

  PATCH        /branches/:id      Update branch   Partial       Branch object
                                                  branch        

  DELETE       /branches/:id      Soft-delete     ---           {success:
                                  branch                        true}
  ------------ ------------------ --------------- ------------- -------------

**5.3 Member Endpoints**

  ------------ ------------------------------ --------------- --------------------- ---------------
  **Method**   **Endpoint**                   **Purpose**     **Input**             **Output**

  GET          /members                       List + filter   ?status, branch_id,   {data:
                                              members         search, page, limit   Member\[\],
                                                                                    total, page}

  POST         /members                       Register new    Member + plan_id      Member +
                                              member                                membership

  GET          /members/:id                   Member          ---                   Member +
                                              profile +                             memberships +
                                              history                               payments +
                                                                                    check_ins

  PATCH        /members/:id                   Update member   Partial member fields Updated member
                                              details                               

  POST         /members/:id/freeze            Freeze          {freeze_start_date,   Updated
                                              membership      freeze_end_date,      membership
                                                              reason}               

  POST         /members/:id/renew             Renew           {plan_id,             New
                                              membership      payment_method}       membership +
                                                                                    payment

  POST         /members/:id/face-descriptor   Save            {descriptor:          {success: true}
                                              face-api.js     float\[128\]}         
                                              descriptor                            

  GET          /members/churn-risk            At-risk member  ?risk=high\|medium    Member\[\] with
                                              list                                  churn_risk
  ------------ ------------------------------ --------------- --------------------- ---------------

**5.4 Check-In Endpoints**

  ------------ -------------------- --------------- --------------------- --------------------
  **Method**   **Endpoint**         **Purpose**     **Input**             **Output**

  POST         /check-ins           Record a        {member_id \|         {success,
                                    check-in        qr_code, branch_id,   member_name,
                                                    checkin_method,       membership_status}
                                                    class_id?}            

  POST         /check-ins/facial    Facial          {descriptor:          {success,
                                    recognition     float\[128\],         matched_member_id,
                                    check-in        branch_id}            confidence}

  POST         /check-ins/sync      Sync offline    {check_ins:           {synced: int,
                                    queue           OfflineCheckIn\[\]}   failed: int}

  GET          /check-ins           Check-in        ?branch_id,           {data: CheckIn\[\],
                                    history         date_from, date_to,   total}
                                                    member_id, page       

  GET          /check-ins/heatmap   Peak hours data ?branch_id, weeks=4   7x24 grid of
                                                                          check-in counts
  ------------ -------------------- --------------- --------------------- --------------------

**5.5 Payments Endpoints**

  ------------ ---------------------------- --------------- --------------------------- --------------
  **Method**   **Endpoint**                 **Purpose**     **Input**                   **Output**

  POST         /payments/cash               Record          {member_id, amount,         Payment +
                                            cash/manual     plan_id, notes}             invoice_url
                                            payment                                     

  POST         /payments/create-order       Create Razorpay {member_id, plan_id,        {order_id,
                                            order           gateway:                    amount,
                                                            \"razorpay\"\|\"stripe\"}   currency, key}

  POST         /payments/verify             Verify gateway  {gateway_payment_id,        Payment +
                                            payment         gateway_order_id,           membership
                                                            signature}                  activated

  POST         /payments/webhook/razorpay   Razorpay        Razorpay webhook body       {received:
                                            webhook handler                             true}

  POST         /payments/webhook/stripe     Stripe webhook  Stripe webhook body         {received:
                                            handler                                     true}

  GET          /payments                    Payment history ?branch_id, date_from,      {data:
                                                            date_to, status, page       Payment\[\],
                                                                                        total, sum}

  GET          /payments/:id/invoice        Download PDF    ---                         PDF blob or
                                            invoice                                     redirect to
                                                                                        Supabase
                                                                                        Storage URL

  GET          /payments/send-link          Send payment    {member_id, plan_id,        {link, sent:
                                            link to member  channel}                    true}
  ------------ ---------------------------- --------------- --------------------------- --------------

**5.6 Dashboard & Analytics Endpoints**

  ------------ -------------------------------- ---------------- ---------------------------
  **Method**   **Endpoint**                     **Purpose**      **Output**

  GET          /dashboard/kpis                  4 hero KPI cards {active_members,
                                                                 monthly_revenue,
                                                                 avg_attendance_rate,
                                                                 expiring_soon_count}

  GET          /dashboard/revenue-chart         Last 12 months   MonthlyRevenue\[\] with
                                                revenue          {month, revenue, expenses,
                                                                 net}

  GET          /dashboard/activity-feed         Last 10          CheckIn\[\] with
                                                check-ins        member_name, branch,
                                                                 method, timestamp

  GET          /dashboard/alerts                Alert panel data {inactive_members\[\],
                                                                 overdue_payments\[\],
                                                                 expiring_memberships\[\]}

  GET          /dashboard/branch-comparison     Multi-branch     Branch\[\] with revenue,
                                                table            members, occupancy,
                                                                 growth_rate

  GET          /analytics/trainer-performance   Trainer metrics  Staff\[\] with
                                                                 classes_count,
                                                                 avg_occupancy,
                                                                 attendance_rate, score
  ------------ -------------------------------- ---------------- ---------------------------

**5.7 AI Advisor Endpoint**

  ------------ -------------------- --------------- ------------------- ------------------------
  **Method**   **Endpoint**         **Purpose**     **Input**           **Output**

  POST         /ai/chat             Send message to {message: string,   {reply: string,
                                    AI Advisor      conversation_id?:   conversation_id,
                                                    uuid}               suggested_actions\[\]}

  GET          /ai/daily-briefing   AI morning      ---                 {summary: string,
                                    summary                             priority_items:
                                                                        string\[3\]}

  GET          /ai/conversations    Chat history    ---                 AIConversation\[\]
                                    list                                
  ------------ -------------------- --------------- ------------------- ------------------------

**🔒 Section 6: Security & Rate Limiting**

**6.1 Authentication & Authorization**

-   Supabase Auth handles user creation, login, and JWT issuance

-   JWT payload must contain: user_id, studio_id, role, branch_ids\[\]

-   NestJS \@UseGuards(JwtAuthGuard) on all protected routes

-   NestJS \@Roles(\'owner\', \'manager\') decorator enforces RBAC per
    endpoint

-   TenantMiddleware runs before every request: extracts studio_id from
    JWT → sets PostgreSQL search_path

-   Max 5 failed login attempts per email → 15-minute lockout
    (implemented in Redis with TTL)

**6.2 Rate Limiting (via \@nestjs/throttler + Upstash Redis)**

  ---------------------- --------------- ---------------- ----------------
  **Endpoint Group**     **Limit**       **Window**       **Why**

  POST /auth/login       10 requests     Per 15 minutes   Brute force
                                         per IP           protection

  POST /ai/chat          30 requests     Per hour per     Claude API cost
                                         studio           control

  POST /check-ins        120 requests    Per minute per   Prevent check-in
                                         branch           flooding

  POST /payments/\*      20 requests     Per minute per   Payment fraud
                                         studio           prevention

  GET /dashboard/\*      60 requests     Per minute per   Dashboard
                                         user             polling
                                                          protection

  All other endpoints    100 requests    Per minute per   General API
                                         user             protection
  ---------------------- --------------- ---------------- ----------------

**6.3 Data Security Rules**

-   All API responses strip salary field from staff objects unless role
    === \"owner\"

-   face_descriptor field never returned in any API response ---
    write-only after enrollment

-   payment_method_token never returned in API responses --- stored
    encrypted at rest

-   Supabase Storage buckets: member-photos (private), invoices
    (private), receipts (private) --- all served via signed URLs with
    1-hour expiry

-   Webhook endpoints (/payments/webhook/\*): verify HMAC signature
    before processing --- reject if invalid

-   CORS: Allow only https://app.musclex.com and localhost:3000 in
    development

**🤖 Section 7: AI Integration**

**7.1 Model & SDK**

-   Provider: Anthropic Claude API

-   Model: claude-sonnet-4-20250514

-   SDK: \@anthropic-ai/sdk (latest)

-   Max tokens per response: 1,024

-   Temperature: 0.3 (consistent, factual business answers)

**7.2 System Prompt Strategy**

> **Context Injection:** Before every AI chat request, the backend
> fetches a live KPI snapshot for the studio and injects it into the
> system prompt. The AI responds as a knowledgeable business advisor
> with real data.

**System Prompt Structure (inject into every /ai/chat call)**

> You are MuscleX AI, a business advisor for {studio_name}.
>
> Today is {current_date}. Timezone: {studio_timezone}.
>
> LIVE STUDIO DATA:
>
> \- Active members: {active_members_count}
>
> \- Members expiring this week: {expiring_this_week}
>
> \- Members 7+ days inactive: {inactive_7d_count}
>
> \- This month revenue: {current_month_revenue} {currency}
>
> \- This month expenses: {current_month_expenses} {currency}
>
> \- Net profit this month: {net_profit} {currency}
>
> \- Avg attendance rate (last 7 days): {avg_attendance_pct}%
>
> \- High churn risk members: {high_churn_count}
>
> \- Top performing trainer: {top_trainer_name} (score: {score})
>
> \- Branches: {branch_names_list}
>
> Answer questions about this studio. Be concise (max 3 sentences).
>
> If recommending action, format it as: ACTION: \<what to do\>
>
> Never invent data. If something is not in the live data above, say so.

**7.3 Conversation History**

-   Conversations stored in ai_conversations.messages as jsonb array of
    {role, content} objects

-   Send last 10 messages as context window to keep API costs low

-   Each conversation linked to one staff member --- owners see all
    conversations they started

-   Conversations auto-expire after 30 days (pg cron job deletes old
    records)

**7.4 AI Daily Briefing (Scheduled Job)**

-   Runs every day at 07:45 AM studio timezone (BullMQ cron job)

-   Fetches live KPI snapshot, calls Claude with prompt: \"In exactly 3
    bullet points, summarize what the gym owner should focus on today.
    Use the live data.\"

-   Response stored in a daily_briefings table and pushed via Supabase
    Realtime to owner\'s dashboard

-   Fallback: If Claude API fails, briefing is skipped silently --- no
    error shown to user

**7.5 Facial Recognition (face-api.js) --- On-Device**

-   Library: face-api.js (v0.22.x) running in browser via TensorFlow.js

-   Models required (loaded from /public/models/):
    face_landmark_68_model, face_recognition_model,
    ssd_mobilenetv1_model

-   Enrollment flow: Capture 3 photos → compute average 128-float
    descriptor → POST /members/:id/face-descriptor → stored in
    members.face_descriptor

-   Check-in flow: Camera frame → detect face → compute descriptor →
    compare vs all enrolled descriptors using euclideanDistance → match
    if distance \< 0.5

-   IMPORTANT: Descriptor comparison happens on the CLIENT (browser),
    not the backend. Backend only stores and serves the descriptors
    array.

-   Privacy: Raw photos are NOT stored after enrollment --- only the
    float\[128\] descriptor

**🚀 Section 8: Deployment Strategy**

**8.1 Environment Setup**

  ----------------- ------------------------ ---------------------------- -------------------
  **Environment**   **Frontend URL**         **API URL**                  **Database**

  Development       localhost:3000           localhost:4000               Supabase local or
                                                                          dev project

  Staging           staging.musclex.com   api-staging.musclex.com   Supabase staging
                                                                          project

  Production        app.musclex.com       api.musclex.com           Supabase production
                                                                          project
  ----------------- ------------------------ ---------------------------- -------------------

**8.2 Step-by-Step Production Deploy**

**Step 1 --- Supabase Setup**

7.  Create Supabase project at supabase.com

8.  Run migrations: supabase db push --- creates public schema tables

9.  Enable Supabase Auth (email/password provider)

10. Create storage buckets: member-photos, invoices, receipts --- set
    all to private

11. Enable Supabase Realtime on check_ins table

12. Create pg_cron extension and schedule daily churn scoring job

**Step 2 --- Upstash Redis Setup**

13. Create free Redis database at upstash.com

14. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env

15. BullMQ connects to this instance for job queues

**Step 3 --- Backend (NestJS on Railway)**

16. Push NestJS code to GitHub repo

17. Create Railway project → Connect GitHub repo → Select NestJS service

18. Set all environment variables in Railway dashboard (see 8.3)

19. Railway auto-detects Dockerfile or package.json start script

20. Set custom domain: api.musclex.com → Railway-provided URL

21. Enable Railway\'s built-in health check on GET /health

**Step 4 --- Frontend (Next.js on Vercel)**

22. Push Next.js code to GitHub repo

23. Import repo in Vercel dashboard → auto-detects Next.js

24. Set environment variables in Vercel project settings (see 8.3)

25. Set custom domain: app.musclex.com

26. Vercel deploys automatically on every push to main branch

**Step 5 --- External Service Configuration**

27. Razorpay: Create account → get Key ID + Key Secret → configure
    webhook URL: https://api.musclex.com/v1/payments/webhook/razorpay

28. Stripe: Create account → get Publishable + Secret keys → configure
    webhook: https://api.musclex.com/v1/payments/webhook/stripe

29. Twilio: Use existing account → get Account SID + Auth Token →
    configure from phone number

30. Meta WhatsApp: Create Meta Business account → WhatsApp Cloud API →
    get Phone Number ID + Access Token → verify webhook

31. Resend: Create account at resend.com → get API key → verify sending
    domain

32. Anthropic: Get API key from console.anthropic.com

**8.3 Required Environment Variables**

  ----------------------------- --------------- -----------------------------
  **Variable Name**             **Where Used**  **Description**

  SUPABASE_URL                  Both            Supabase project URL

  SUPABASE_ANON_KEY             Frontend        Public anon key for
                                                client-side auth

  SUPABASE_SERVICE_ROLE_KEY     Backend only    Server-side privileged key
                                                --- never expose to frontend

  JWT_SECRET                    Backend         Secret for signing custom
                                                JWTs

  ANTHROPIC_API_KEY             Backend         Claude AI API key

  RAZORPAY_KEY_ID               Both            Public Razorpay key (frontend
                                                for checkout)

  RAZORPAY_KEY_SECRET           Backend only    Secret key --- never expose
                                                to frontend

  STRIPE_PUBLISHABLE_KEY        Frontend        Public Stripe key

  STRIPE_SECRET_KEY             Backend only    

  STRIPE_WEBHOOK_SECRET         Backend         For verifying Stripe webhook
                                                signatures

  TWILIO_ACCOUNT_SID            Backend         From existing Twilio account

  TWILIO_AUTH_TOKEN             Backend         

  TWILIO_FROM_NUMBER            Backend         Twilio SMS sender number

  META_WA_PHONE_NUMBER_ID       Backend         WhatsApp Cloud API phone
                                                number ID

  META_WA_ACCESS_TOKEN          Backend         Meta permanent access token

  META_WA_VERIFY_TOKEN          Backend         Webhook verification secret

  RESEND_API_KEY                Backend         Resend.com transactional
                                                email key

  UPSTASH_REDIS_REST_URL        Backend         Upstash Redis for BullMQ

  UPSTASH_REDIS_REST_TOKEN      Backend         

  NEXT_PUBLIC_API_URL           Frontend        Backend API base URL

  NEXT_PUBLIC_SUPABASE_URL      Frontend        Same as SUPABASE_URL

  NEXT_PUBLIC_RAZORPAY_KEY_ID   Frontend        Same as RAZORPAY_KEY_ID
  ----------------------------- --------------- -----------------------------

**📊 Section 9: Performance Requirements**

  ---------------------- ---------------- ----------------- ----------------
  **Metric**             **Target**       **Measurement**   **Priority**

  Dashboard initial load \< 2s            Core Web Vitals   🔴 Critical
                                          LCP               

  Check-in confirmation  \< 1s            API response time 🔴 Critical
  display                                 P95               

  AI advisor response    \< 4s            End-to-end wall   🟡 High
                                          clock             

  Member list load (500  \< 1.5s          API response P95  🟡 High
  members)                                                  

  QR scan to check-in    \< 2s            End-to-end wall   🔴 Critical
  confirmation                            clock             

  Facial recognition     \< 3s            Browser JS        🟡 High
  match time                              execution         

  Real-time check-in     \< 5s            WebSocket event   🟡 High
  feed latency                            delay             

  Offline check-in sync  \< 30s after     Background sync   🟢 Normal
                         reconnect        timer             

  Invoice PDF generation \< 3s            API response time 🟢 Normal

  Concurrent active      500+             Load test with k6 🟡 High at scale
  studios                simultaneously                     

  Database query (single \< 100ms P95     Supabase query    🔴 Critical
  studio)                                 logs              

  Mobile app size (React \< 50MB install  Expo build output 🟢 Phase 2
  Native)                                                   
  ---------------------- ---------------- ----------------- ----------------

**9.1 Performance Implementation Rules**

-   Dashboard KPIs: Cached in Redis for 60 seconds ---
    stale-while-revalidate pattern

-   Member list: Paginated (default 50 per page) --- never load all
    members at once

-   Revenue chart: Pre-aggregated monthly in a materialized view,
    refreshed daily

-   face-api.js models: Loaded once on check-in screen mount, cached in
    browser memory

-   Images: Served from Supabase CDN via signed URLs --- next/image with
    lazy loading

-   React Query: Cache time 5 minutes for non-real-time data, 0 for
    check-in feed

**💰 Section 10: Cost Estimate**

**10.1 Free Tier Limits Reference**

  ---------------- --------------------- ------------------ -----------------
  **Service**      **Free Tier Limit**   **Cost After       **Your Usage
                                         Free**             Pattern**

  Supabase         500MB DB, 1GB         \$25/month Pro     1 project for all
                   storage, 50k MAU                         studios

  Vercel           Unlimited deploys,    \$20/month Pro     Next.js frontend
                   100GB bandwidth                          

  Railway          \$5 free credit/month \~\$10--30/month   NestJS API server
                                         usage              

  Upstash Redis    10,000 req/day        \$0.20 per 100k    BullMQ + rate
                                         req                limiting

  Resend           3,000 emails/month    \$20/month for 50k Transactional
                                                            email

  Twilio SMS       Trial credit only     \~\$0.0075/SMS     Renewal reminders
                                         India              

  Meta WhatsApp    1,000                 \~\$0.004/conv     Automated
                   conversations/month   India              messages

  Anthropic Claude No free tier          \~\$0.003/1k input AI advisor
                                         tokens             queries

  Sentry           5,000 errors/month    \$26/month Team    Error monitoring

  Posthog          1M events/month       \$0.000225/event   Usage analytics
  ---------------- --------------------- ------------------ -----------------

**10.2 Monthly Cost by Studio Count**

  --------------------- ------------------ --------------------- -----------------------
  **Service**           **0--10 Studios**  **50--100 Studios**   **500+ Studios**

  Supabase              \$0 (free)         \$25 (Pro)            \$0.015/GB + compute

  Vercel                \$0 (free)         \$0 (free enough)     \$20 (Pro)

  Railway (API)         \$5--10            \$15--30              \$50--100

  Upstash Redis         \$0 (free)         \$5--10               \$20--50

  Twilio SMS            \$5--15            \$30--80              \$200--500

  Meta WhatsApp         \$0 (free tier)    \$10--30              \$100--300

  Anthropic Claude      \$5--20            \$30--80              \$200--500

  Resend Email          \$0 (free)         \$20                  \$90

  TOTAL ESTIMATE        \~\$15--45/month   \~\$135--275/month    \~\$680--1,560/month

  **SaaS Revenue        **\$500--2,000**   **\$5,000--15,000**   **\$50,000--150,000**
  (est.)**                                                       
  --------------------- ------------------ --------------------- -----------------------

> **Verdict:** Profitable from 10+ paying studios. Free tiers cover
> 0--10 studios. At \$500/month infra budget (your stated ceiling), you
> can comfortably serve 100+ studios.

**📋 Section 11: Development Checklist**

> **Build Order Rule:** Always build in this order: Infrastructure →
> Auth → Core Data → Check-In → Payments → Analytics → AI → Marketing.
> Never skip ahead. Each phase depends on the previous.

**Phase 1 --- Foundation (Weeks 1--4)**

**Week 1: Project Setup & Auth**

-   \[ \] Initialize Next.js 14 project with App Router + TypeScript

-   \[ \] Install and configure Tailwind CSS + shadcn/ui

-   \[ \] Initialize NestJS project with TypeScript + Prisma

-   \[ \] Create Supabase project --- copy keys to .env files

-   \[ \] Set up Supabase Auth (email/password)

-   \[ \] Create public schema tables: studios, subscriptions

-   \[ \] Build Login screen (S01) --- email + password form

-   \[ \] Build Forgot Password / Reset screen (S03)

-   \[ \] Build Onboarding screen (S02) --- studio name + first branch
    setup

-   \[ \] Implement JWT guard and TenantMiddleware in NestJS

-   \[ \] Implement studio schema auto-creation on signup

-   \[ \] Set up Railway deployment for NestJS

-   \[ \] Set up Vercel deployment for Next.js

-   \[ \] Set up Sentry error tracking in both projects

**Week 2: Members & Check-In Core**

-   \[ \] Create per-studio schema tables: members, membership_plans,
    member_memberships

-   \[ \] Build Member List screen (S07) --- search, filter, paginated
    table

-   \[ \] Build Add/Edit Member screen (S09) --- registration form with
    validation

-   \[ \] Build Member Profile screen (S08) --- history, status badge,
    quick actions

-   \[ \] Create membership_plans CRUD (S29)

-   \[ \] Implement member_code auto-generation (FS-YYYYMMDD-XXXX)

-   \[ \] Implement qr_code generation (UUID → QR image)

-   \[ \] Build Check-In Screen (S10) --- staff tablet view

-   \[ \] Integrate html5-qrcode for QR scanning

-   \[ \] Implement POST /check-ins API with validation logic

-   \[ \] Create check_ins table and attendance tracking

-   \[ \] Implement IndexedDB offline queue for check-ins (idb library)

-   \[ \] Implement POST /check-ins/sync for offline sync

**Week 3: Payments & Finance**

-   \[ \] Create payments and expenses tables

-   \[ \] Build Record Payment screen (S18) --- manual cash form

-   \[ \] Integrate Razorpay: create order → checkout → verify →
    activate membership

-   \[ \] Integrate Stripe as alternative gateway

-   \[ \] Implement Razorpay + Stripe webhook handlers with HMAC
    verification

-   \[ \] Build invoice PDF generation (@react-pdf/renderer)

-   \[ \] Upload invoice PDF to Supabase Storage → store URL in
    payments.invoice_url

-   \[ \] Build Payments List screen (S17) --- filters, export

-   \[ \] Build Expense Tracker screen (S19) --- add expense + category
    chart

-   \[ \] Build Invoice View screen (S20) --- download button

-   \[ \] Implement auto-renewal job (BullMQ) --- charge 1 day before
    expiry

**Week 4: Dashboard & Branches**

-   \[ \] Build Main Dashboard (S04) --- 4 KPI cards

-   \[ \] Implement GET /dashboard/kpis with Redis caching

-   \[ \] Build Revenue Chart (recharts --- last 12 months bar chart)

-   \[ \] Build Activity Feed (last 10 check-ins)

-   \[ \] Build Alert Panel --- expiring, overdue, inactive

-   \[ \] Enable Supabase Realtime on check_ins → update feed live

-   \[ \] Build Branch Selector View (S05)

-   \[ \] Build Branch Comparison Table

-   \[ \] Build Studio Settings screen (S28)

-   \[ \] Implement multi-branch KPI filtering

**Phase 2 --- Intelligence (Weeks 5--8)**

**Week 5: Classes & Staff**

-   \[ \] Create classes, class_enrollments, staff tables

-   \[ \] Build Schedule Calendar (S12) using \@fullcalendar/react

-   \[ \] Build Create/Edit Class screen (S14) with recurrence rule
    support

-   \[ \] Build Class Detail screen (S13) --- roster + check-in

-   \[ \] Build Waitlist Manager (S15)

-   \[ \] Build Staff List (S21) and Staff Profile (S22)

-   \[ \] Build Add/Edit Staff screen (S23) with role assignment

-   \[ \] Implement conflict detection for trainer double-booking

**Week 6: Facial Recognition & AI Advisor**

-   \[ \] Download and place face-api.js model files in /public/models/

-   \[ \] Build face enrollment flow in member registration (3-photo
    capture)

-   \[ \] Implement client-side facial recognition on Check-In Screen

-   \[ \] Build POST /members/:id/face-descriptor endpoint

-   \[ \] Build POST /check-ins/facial endpoint (descriptor matching)

-   \[ \] Set up Anthropic Claude API integration

-   \[ \] Build AI Chat Overlay (S06) --- floating panel with
    conversation UI

-   \[ \] Implement POST /ai/chat with live studio context injection

-   \[ \] Implement conversation history persistence in ai_conversations

-   \[ \] Build GET /ai/daily-briefing and BullMQ cron at 07:45 AM

**Week 7: Marketing & Notifications**

-   \[ \] Create notifications_log and campaigns tables

-   \[ \] Integrate Twilio SMS --- implement sendSMS() service

-   \[ \] Integrate Meta WhatsApp Cloud API --- implement sendWhatsApp()
    service

-   \[ \] Integrate Resend --- create React Email templates for:
    welcome, renewal reminder, payment receipt, win-back

-   \[ \] Implement automated trigger jobs in BullMQ: expiry reminders
    (7d, 3d, 1d), inactivity alert (7d, 14d), birthday greeting

-   \[ \] Build Automation Rules screen (S26) --- toggle triggers on/off

-   \[ \] Build Campaign Creator screen (S25) --- segment + message +
    schedule

-   \[ \] Build Marketing Dashboard (S24) --- active campaigns + stats

-   \[ \] Build Referral Program screen (S27) --- code management +
    rewards

-   \[ \] Create referral_codes table and reward tracking logic

**Week 8: Analytics, Churn & Polish**

-   \[ \] Implement churn risk scoring algorithm --- daily BullMQ job

-   \[ \] Build Churn Risk List screen (S11) --- high/medium/low
    segments

-   \[ \] Build Peak Hours Heatmap (GET /check-ins/heatmap → custom
    recharts heatmap)

-   \[ \] Build Trainer Performance Dashboard --- GET
    /analytics/trainer-performance

-   \[ \] Build Financial Dashboard (S16) --- P&L chart, revenue vs
    expense

-   \[ \] Implement engagement_score calculation (daily job)

-   \[ \] Integrations screen (S30) --- connect payment gateway,
    configure SMS/email

-   \[ \] Run OWASP security checklist

-   \[ \] Performance test all critical paths with k6 or Artillery

-   \[ \] Set up Posthog analytics events

-   \[ \] Fix all P1/P2 bugs

-   \[ \] LAUNCH Phase 1 (Web) 🚀

**Phase 3 --- Mobile (Weeks 9--16)**

-   \[ \] Initialize Expo React Native project

-   \[ \] Reuse all API endpoints (zero backend changes needed)

-   \[ \] Reuse Zustand stores and React Query hooks (shared logic
    layer)

-   \[ \] Build all 30 screens in React Native using NativeWind +
    shadcn-style components

-   \[ \] Integrate expo-camera + expo-barcode-scanner for QR check-in

-   \[ \] Integrate Expo Notifications for push notification support

-   \[ \] Submit to Apple App Store + Google Play Store

**🎯 Section 12: Technical Success Criteria**

> **Definition:** The product is technically \"done\" when ALL of the
> following criteria pass. No exceptions.

**12.1 Functional Criteria**

  ------------------------------ ------------------------ ----------------
  **Criterion**                  **How to Verify**        **Pass/Fail**

  Owner can register, log in,    Manual test ---          All 3 steps work
  set up studio and first branch end-to-end flow          

  Staff can add member + assign  Timed manual test        \< 3 minutes
  plan in \< 3 min                                        

  QR check-in confirms in \< 1   Stopwatch test x10       \< 1s on P95
  second                         attempts                 

  Facial recognition matches     Enroll 5 members, test   \>95% accuracy
  enrolled member                20 check-ins             

  Offline check-ins sync on      Disable WiFi, check in 5 All 5 synced
  reconnect                      members, re-enable,      within 30s
                                 verify sync              

  Razorpay payment creates +     Test payment flow in     Membership
  activates membership           test mode                active after pay

  Auto-renewal triggers and      Set expiry to tomorrow,  Charge + new
  charges correctly              run job manually         membership

  AI advisor answers 5 standard  Ask 5 sample questions   All 5 answered
  business queries               from PRD spec            factually

  Dashboard real-time feed       Check in on tablet,      Update within 5
  updates on check-in            observe dashboard on     seconds
                                 another device           

  WhatsApp expiry reminder       Trigger reminder         Message received
  delivered                      manually for test member 

  Multi-branch: Studio 2 cannot  Create 2 studios, log in Zero
  see Studio 1 data              as Studio 2, query       cross-tenant
                                 /members                 data

  Invoice PDF generated and      Record payment, click    PDF opens
  downloadable                   download invoice         correctly
  ------------------------------ ------------------------ ----------------

**12.2 Security Criteria**

-   \[ \] Unauthenticated request to /members returns 401 --- verified

-   \[ \] Front Desk staff cannot access /dashboard/kpis --- returns 403
    --- verified

-   \[ \] Razorpay webhook with invalid signature returns 400 ---
    verified

-   \[ \] Login lockout triggers after 5 failed attempts --- verified

-   \[ \] face_descriptor field absent from all GET /members responses
    --- verified

-   \[ \] SUPABASE_SERVICE_ROLE_KEY not present in any frontend bundle
    --- verified via build output inspection

**12.3 Performance Criteria**

-   \[ \] Dashboard LCP \< 2s on throttled 4G --- measured in Chrome
    DevTools

-   \[ \] POST /check-ins response P95 \< 500ms --- measured in k6 load
    test

-   \[ \] All Supabase queries \< 100ms --- verified in Supabase
    dashboard

-   \[ \] No memory leak in facial recognition loop (check-in screen
    open 30 min) --- verified in Chrome Memory tab

-   \[ \] App passes Lighthouse scores: Performance \>80, Accessibility
    \>90 --- verified

**END OF DOCUMENT**

MuscleX TRD v1.0 \| Built for vibe coding \| AI tools: read this
verbatim ⚡
