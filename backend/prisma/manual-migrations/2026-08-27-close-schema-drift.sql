-- ────────────────────────────────────────────────────────────────
-- Close the remaining schema.prisma <-> production drift
-- ────────────────────────────────────────────────────────────────
--
-- WHY THIS EXISTS
-- production's public._prisma_migrations is EMPTY while the repo carries 69
-- migration directories, so migrations have been applied by hand and several
-- were missed. Every object below is declared in schema.prisma and absent from
-- the database, which means the Prisma client generates SQL referencing columns
-- that do not exist and the endpoint 500s. Known live breakage this fixes:
--   * public.device_index    — devices.service.ts does pub.deviceIndex.upsert()
--                              on every biometric device registration
--   * public.backup_codes    — two-factor.service.ts issues 8 codes at enrolment
--   * member_routines.name / .source_token — member-routine.service.ts writes
--                              both; the table still has the pre-rename
--                              title / share_token
--
-- SAFETY
--   * additive except two RENAMEs, which preserve data and are each guarded to
--     fire only when the old column is present and the new one is not
--   * every table/column/index is IF NOT EXISTS; FKs are guarded on
--     pg_constraint because ADD CONSTRAINT has no IF NOT EXISTS
--   * nothing is dropped
--   * verified before writing: member_routines is EMPTY in all 7 schemas, so
--     the renames move no rows
--
-- Deliberately NO BEGIN/COMMIT: the applier wraps each file in its own
-- transaction, which is what makes --rehearse able to actually roll back.
--
-- Unlike the expense fan-out, this INCLUDES studio_template — it is missing
-- notifications and dashboard_metrics too, so new gyms inherit the gap.

DO $mig$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace WHERE nspname LIKE 'studio\_%' ORDER BY nspname
  LOOP
    -- ── notifications ─────────────────────────────────────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I.notifications (
        id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
        gym_id              uuid        NOT NULL,
        user_id             uuid        NOT NULL,
        type                text        NOT NULL,
        title               text        NOT NULL,
        message             text        NOT NULL,
        data                jsonb       NOT NULL DEFAULT '{}'::jsonb,
        related_entity_id   uuid,
        related_entity_type text,
        is_read             boolean     NOT NULL DEFAULT false,
        read_at             timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT notifications_pkey PRIMARY KEY (id)
      );
      CREATE INDEX IF NOT EXISTS notifications_gym_id_user_id_is_read_idx
        ON %1$I.notifications (gym_id, user_id, is_read);
      CREATE INDEX IF NOT EXISTS notifications_created_at_idx
        ON %1$I.notifications (created_at);

      CREATE TABLE IF NOT EXISTS %1$I.dashboard_metrics (
        id                   uuid           NOT NULL DEFAULT gen_random_uuid(),
        gym_id               uuid           NOT NULL,
        branch_id            uuid,
        total_members        integer        NOT NULL DEFAULT 0,
        active_members       integer        NOT NULL DEFAULT 0,
        total_staff          integer        NOT NULL DEFAULT 0,
        active_staff         integer        NOT NULL DEFAULT 0,
        monthly_revenue      numeric(12,2)  NOT NULL DEFAULT 0,
        total_revenue        numeric(14,2)  NOT NULL DEFAULT 0,
        check_ins_today      integer        NOT NULL DEFAULT 0,
        check_ins_month      integer        NOT NULL DEFAULT 0,
        expiring_memberships integer        NOT NULL DEFAULT 0,
        revenue_month        text,
        version              bigint         NOT NULL DEFAULT 0,
        last_event_id        uuid,
        last_synced_at       timestamptz    NOT NULL DEFAULT now(),
        created_at           timestamptz    NOT NULL DEFAULT now(),
        updated_at           timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT dashboard_metrics_pkey PRIMARY KEY (id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_metrics_gym_id_branch_id_key
        ON %1$I.dashboard_metrics (gym_id, branch_id);

      ALTER TABLE %1$I.expense_metrics
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

      ALTER TABLE %1$I.member_routine_exercises
        ADD COLUMN IF NOT EXISTS target_duration_seconds integer;
    $f$, s.nspname);

    -- ── member_routines: the rename that never ran ────────────────
    -- Guarded on both sides so this is a no-op once applied, and so a schema
    -- that somehow already has `name` is never touched.
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = s.nspname AND table_name = 'member_routines' AND column_name = 'title')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = s.nspname AND table_name = 'member_routines' AND column_name = 'name') THEN
      EXECUTE format('ALTER TABLE %I.member_routines RENAME COLUMN title TO name', s.nspname);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = s.nspname AND table_name = 'member_routines' AND column_name = 'share_token')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = s.nspname AND table_name = 'member_routines' AND column_name = 'source_token') THEN
      EXECUTE format('ALTER TABLE %I.member_routines RENAME COLUMN share_token TO source_token', s.nspname);
    END IF;

    -- dashboard_metrics -> branches FK, only where branches exists
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = s.nspname AND table_name = 'branches')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'dashboard_metrics_branch_id_fkey'
                  AND connamespace = s.nspname::regnamespace) THEN
      EXECUTE format($f$ALTER TABLE %1$I.dashboard_metrics ADD CONSTRAINT dashboard_metrics_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES %1$I.branches (id)
        ON DELETE SET NULL ON UPDATE CASCADE$f$, s.nspname);
    END IF;

    RAISE NOTICE 'drift closed: %', s.nspname;
  END LOOP;
END
$mig$;

-- ── public.device_index ─────────────────────────────────────────
-- Maps a biometric device to the gym+schema that owns it. Read on every device
-- request before any tenant context exists, which is why it lives in public and
-- carries schema_name rather than being tenant-scoped.
CREATE TABLE IF NOT EXISTS public.device_index (
  device_id   uuid        NOT NULL,
  gym_id      uuid        NOT NULL,
  schema_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_index_pkey PRIMARY KEY (device_id)
);
CREATE INDEX IF NOT EXISTS device_index_gym_id_idx ON public.device_index (gym_id);

-- ── public.backup_codes ─────────────────────────────────────────
-- Single-use 2FA recovery codes. Stored hashed; used_at marks redemption.
CREATE TABLE IF NOT EXISTS public.backup_codes (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_identity_id uuid        NOT NULL,
  code_hash        text        NOT NULL,
  used_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backup_codes_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS backup_codes_user_identity_id_used_at_idx
  ON public.backup_codes (user_identity_id, used_at);

DO $fk$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'user_identities')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backup_codes_user_identity_id_fkey') THEN
    ALTER TABLE public.backup_codes ADD CONSTRAINT backup_codes_user_identity_id_fkey
      FOREIGN KEY (user_identity_id) REFERENCES public.user_identities (id) ON DELETE CASCADE;
  END IF;
END
$fk$;
