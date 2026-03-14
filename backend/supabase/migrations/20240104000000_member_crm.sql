-- ============================================================
-- Migration: Member CRM System
-- Extends: members with organization_id, gender, join_date, last_visit_at
-- Adds: member_profiles, member_body_stats, member_notes,
--        member_tags, member_tag_assignments, member_documents,
--        member_referrals
-- ============================================================

-- ── Extend Members Table ───────────────────────────────────────

ALTER TABLE studio_template.members
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES studio_template.organizations(id),
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS join_date DATE,
  ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_members_organization_id
  ON studio_template.members (organization_id);

CREATE INDEX IF NOT EXISTS idx_members_phone
  ON studio_template.members (phone);

CREATE INDEX IF NOT EXISTS idx_members_email
  ON studio_template.members (email);

-- ── Member Profiles (Health/Fitness Data) ──────────────────────

CREATE TABLE IF NOT EXISTS studio_template.member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  body_fat_percentage DECIMAL(5,2),
  fitness_goal TEXT,
  medical_conditions TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  emergency_contact TEXT,
  emergency_phone TEXT,
  blood_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Member Body Stats (Progress Tracking) ──────────────────────

CREATE TABLE IF NOT EXISTS studio_template.member_body_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  weight DECIMAL(5,2),
  body_fat DECIMAL(5,2),
  muscle_mass DECIMAL(5,2),
  bmi DECIMAL(5,2),
  chest DECIMAL(5,2),
  waist DECIMAL(5,2),
  hips DECIMAL(5,2),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_body_stats_member_recorded
  ON studio_template.member_body_stats (member_id, recorded_at);

-- ── Member Notes ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.member_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  staff_id UUID
    REFERENCES studio_template.staff(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_notes_member_created
  ON studio_template.member_notes (member_id, created_at);

-- ── Member Tags ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.member_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Member Tag Assignments ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.member_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL
    REFERENCES studio_template.member_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_member_tag UNIQUE (member_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_member_tag_assignments_tag
  ON studio_template.member_tag_assignments (tag_id);

-- ── Member Documents ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.member_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_documents_member
  ON studio_template.member_documents (member_id);

-- ── Member Referrals ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.member_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  referred_member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  reward_status TEXT NOT NULL DEFAULT 'pending',
  reward_type TEXT,
  reward_value DECIMAL(10,2),
  awarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_referral UNIQUE (referrer_member_id, referred_member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_referrals_referrer
  ON studio_template.member_referrals (referrer_member_id);

CREATE INDEX IF NOT EXISTS idx_member_referrals_referred
  ON studio_template.member_referrals (referred_member_id);

-- ── Seed Default Tags ──────────────────────────────────────────

INSERT INTO studio_template.member_tags (name, color, description)
VALUES
  ('VIP', '#FFD700', 'VIP member with premium benefits'),
  ('Athlete', '#4A9FD4', 'Competitive athlete or sports-focused'),
  ('Beginner', '#34C77A', 'New to fitness'),
  ('Weight Loss', '#F59E0B', 'Focused on weight loss goals'),
  ('High Risk', '#EF4444', 'High churn risk or health concern')
ON CONFLICT (name) DO NOTHING;
