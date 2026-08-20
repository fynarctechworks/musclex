-- Exercise thumbnail URL (2026-08-20).
--
-- WHY: `media_url` holds the animated GIF, which is what the detail view wants
-- because the animation IS the form cue. A picker list showing forty 300KB
-- GIFs at 40x40 would download ~12MB to render thumbnails, so lists need a
-- separate lightweight asset rather than the same file scaled down.
--
-- Nullable, no backfill, no default: exercises without a thumbnail fall back to
-- the placeholder glyph exactly as they do today.
--
-- Idempotent and additive. studio_template AND every live studio_%.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace
    WHERE nspname = 'studio_template' OR nspname LIKE 'studio\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.exercises ADD COLUMN IF NOT EXISTS thumb_url text', s);
    RAISE NOTICE 'thumb_url ready on %', s;
  END LOOP;
END $$;
