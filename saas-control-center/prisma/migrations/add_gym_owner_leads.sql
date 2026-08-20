-- Gym Owner Leads — enquiries submitted from the public marketing website
-- (marketing/ contact form). These are PROSPECTIVE TENANTS: gym owners asking
-- about MuscleX before they have an account.
--
-- NOT to be confused with the member-app "Leads" surface
-- (frontend/src/app/(dashboard)/member-app/leads), which lists registered
-- consumer app users who have not joined a gym yet. Different audience,
-- different funnel, different table.
--
-- Lives in the `scc` schema, which is internal and NOT exposed to
-- PostgREST/anon, so no RLS surface is added to `public`.
--
-- Idempotent (IF NOT EXISTS) — safe to re-run via
-- `npx ts-node scripts/apply-migrations.ts`.

CREATE TABLE IF NOT EXISTS scc.gym_owner_leads (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Submitted by the prospect.
    name         TEXT        NOT NULL,
    studio_name  TEXT        NOT NULL,
    email        TEXT        NOT NULL,
    phone        TEXT        NOT NULL,
    branches     TEXT        NULL,   -- '1' | '2-5' | '6-20' | '20+'
    topic        TEXT        NULL,   -- 'Pricing and plans', 'Migrating…', …
    message      TEXT        NOT NULL,

    -- Worked by the SCC admin.
    status       TEXT        NOT NULL DEFAULT 'NEW',
    notes        TEXT        NULL,

    -- Provenance. `source` allows future marketing forms (demo request,
    -- newsletter) to share this table without another migration.
    source       TEXT        NOT NULL DEFAULT 'marketing_contact',
    user_agent   TEXT        NULL,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The list view is "newest first, optionally filtered by status".
CREATE INDEX IF NOT EXISTS gym_owner_leads_status_created_idx
    ON scc.gym_owner_leads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS gym_owner_leads_created_idx
    ON scc.gym_owner_leads (created_at DESC);

-- Supports "have we heard from this studio before?" lookups from the detail
-- drawer without a sequential scan.
CREATE INDEX IF NOT EXISTS gym_owner_leads_email_idx
    ON scc.gym_owner_leads (lower(email));
