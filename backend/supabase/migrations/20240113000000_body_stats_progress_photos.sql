-- Add missing measurement columns to member_body_stats
ALTER TABLE member_body_stats ADD COLUMN IF NOT EXISTS arms   DECIMAL(5,2);
ALTER TABLE member_body_stats ADD COLUMN IF NOT EXISTS thighs DECIMAL(5,2);
ALTER TABLE member_body_stats ADD COLUMN IF NOT EXISTS calves DECIMAL(5,2);

-- Create progress photos table
CREATE TABLE IF NOT EXISTS member_progress_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  photo_url  TEXT NOT NULL,
  caption    TEXT,
  photo_type TEXT NOT NULL DEFAULT 'progress', -- before | after | progress
  taken_at   TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_progress_photos_member_taken
  ON member_progress_photos(member_id, taken_at);
