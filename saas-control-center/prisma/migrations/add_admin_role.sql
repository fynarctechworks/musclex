-- H1: per-admin roles for the SCC.
-- All existing rows default to SUPER (the only role at bootstrap), preserving
-- current access. Going forward, RolesGuard checks AdminUser.role against the
-- @Roles(...) decorator on each endpoint.

DO $$ BEGIN
  CREATE TYPE scc."AdminRole" AS ENUM ('SUPER', 'BILLING', 'SUPPORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE scc.admin_users
    ADD COLUMN IF NOT EXISTS role scc."AdminRole" NOT NULL DEFAULT 'SUPER';
