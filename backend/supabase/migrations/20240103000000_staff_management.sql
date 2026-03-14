-- ============================================================
-- Migration: Staff Management System
-- Adds: staff_profiles, staff_availability, staff_attendance,
--        trainer_clients, trainer_sessions, payroll_configs,
--        trainer_revenue
-- Extends: staff with organization hierarchy fields
-- ============================================================

-- ── Extend Staff Table ─────────────────────────────────────────

ALTER TABLE studio_template.staff
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES studio_template.organizations(id),
  ADD COLUMN IF NOT EXISTS branch_id UUID
    REFERENCES studio_template.branches(id),
  ADD COLUMN IF NOT EXISTS employee_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_staff_organization_id
  ON studio_template.staff (organization_id);

CREATE INDEX IF NOT EXISTS idx_staff_branch_id
  ON studio_template.staff (branch_id);

CREATE INDEX IF NOT EXISTS idx_staff_status
  ON studio_template.staff (status);

-- ── Staff Profiles ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL UNIQUE
    REFERENCES studio_template.staff(id) ON DELETE CASCADE,
  bio TEXT,
  certifications TEXT[] DEFAULT '{}',
  specializations TEXT[] DEFAULT '{}',
  experience_years INT NOT NULL DEFAULT 0,
  profile_photo TEXT,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  total_ratings INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Staff Availability ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL
    REFERENCES studio_template.staff(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,       -- 0=Sunday .. 6=Saturday
  start_time TEXT NOT NULL,        -- "HH:mm"
  end_time TEXT NOT NULL,          -- "HH:mm"
  availability_type TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_day
  ON studio_template.staff_availability (staff_id, day_of_week);

-- ── Staff Attendance ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL
    REFERENCES studio_template.staff(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL
    REFERENCES studio_template.branches(id),
  check_in_time TIMESTAMPTZ NOT NULL,
  check_out_time TIMESTAMPTZ,
  method TEXT NOT NULL DEFAULT 'manual',  -- biometric | qr | manual | mobile
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_checkin
  ON studio_template.staff_attendance (staff_id, check_in_time);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch_checkin
  ON studio_template.staff_attendance (branch_id, check_in_time);

-- ── Trainer Clients ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.trainer_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL
    REFERENCES studio_template.staff(id) ON DELETE CASCADE,
  member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_trainer_client UNIQUE (trainer_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer_status
  ON studio_template.trainer_clients (trainer_id, status);

CREATE INDEX IF NOT EXISTS idx_trainer_clients_member
  ON studio_template.trainer_clients (member_id);

-- ── Trainer Sessions ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.trainer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL
    REFERENCES studio_template.staff(id) ON DELETE CASCADE,
  member_id UUID NOT NULL
    REFERENCES studio_template.members(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL
    REFERENCES studio_template.branches(id),
  session_date TIMESTAMPTZ NOT NULL,
  session_duration INT NOT NULL,          -- minutes
  session_type TEXT NOT NULL DEFAULT 'personal_training',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_sessions_trainer_date
  ON studio_template.trainer_sessions (trainer_id, session_date);

CREATE INDEX IF NOT EXISTS idx_trainer_sessions_member_date
  ON studio_template.trainer_sessions (member_id, session_date);

CREATE INDEX IF NOT EXISTS idx_trainer_sessions_branch_date
  ON studio_template.trainer_sessions (branch_id, session_date);

-- ── Payroll Configs ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.payroll_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL UNIQUE
    REFERENCES studio_template.staff(id) ON DELETE CASCADE,
  salary_type TEXT NOT NULL DEFAULT 'fixed',
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  bonus_structure JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Trainer Revenue ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_template.trainer_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL
    REFERENCES studio_template.staff(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL
    REFERENCES studio_template.branches(id),
  session_id UUID UNIQUE
    REFERENCES studio_template.trainer_sessions(id),
  revenue_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_revenue_trainer_created
  ON studio_template.trainer_revenue (trainer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_trainer_revenue_branch_created
  ON studio_template.trainer_revenue (branch_id, created_at);
