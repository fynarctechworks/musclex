-- ============================================================================
-- MIGRATION: Add check_out_at to check_ins (visit pairing)
-- ============================================================================
--
-- Adds `check_out_at TIMESTAMPTZ NULL` to check_ins so each row represents one
-- visit (in -> out) instead of just an entry. A NULL value means the member is
-- still inside; checkout updates the most recent open check-in for the member.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, replicated across every studio_* schema.
-- ============================================================================

ALTER TABLE "studio_template"."check_ins"
  ADD COLUMN IF NOT EXISTS "check_out_at" TIMESTAMPTZ;

-- Partial index to speed up the "find open check-in for member" lookup.
CREATE INDEX IF NOT EXISTS "check_ins_open_visit_idx"
    ON "studio_template"."check_ins" (member_id, checked_in_at DESC)
 WHERE check_out_at IS NULL AND status = 'success';

-- Replicate to every existing studio_* schema.
DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname FROM pg_namespace
         WHERE nspname LIKE 'studio_%' AND nspname != 'studio_template'
    LOOP
        EXECUTE format($f$
            ALTER TABLE %I.check_ins
              ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ;

            CREATE INDEX IF NOT EXISTS check_ins_open_visit_idx
                ON %I.check_ins (member_id, checked_in_at DESC)
             WHERE check_out_at IS NULL AND status = 'success';
        $f$, schema_name, schema_name);
    END LOOP;
END $$;

-- End of migration.
