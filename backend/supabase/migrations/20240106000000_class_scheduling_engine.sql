-- Migration: Class & Facility Scheduling Engine
-- Creates tables for class templates, studio rooms, sessions, bookings, waitlists,
-- trainer assignments, attendance tracking, and recurring class rules.

-- ============================================================
-- Class Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS class_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  default_duration_minutes INT NOT NULL DEFAULT 60,
  default_capacity INT NOT NULL DEFAULT 20,
  created_by_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_templates_org ON class_templates(organization_id);
CREATE INDEX idx_class_templates_branch ON class_templates(branch_id);
CREATE INDEX idx_class_templates_category ON class_templates(category);

-- ============================================================
-- Studio Rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS studio_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  capacity INT NOT NULL DEFAULT 30,
  equipment_available TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_studio_rooms_branch ON studio_rooms(branch_id);

-- ============================================================
-- Class Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES class_templates(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  studio_id UUID REFERENCES studio_rooms(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL,
  enrolled_count INT NOT NULL DEFAULT 0,
  waitlist_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_sessions_branch_time ON class_sessions(branch_id, start_time);
CREATE INDEX idx_class_sessions_trainer_time ON class_sessions(trainer_id, start_time);
CREATE INDEX idx_class_sessions_studio_time ON class_sessions(studio_id, start_time);
CREATE INDEX idx_class_sessions_template ON class_sessions(template_id);
CREATE INDEX idx_class_sessions_status ON class_sessions(status);

-- ============================================================
-- Class Bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  booking_status VARCHAR(20) NOT NULL DEFAULT 'booked',
  booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  attended BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(session_id, member_id)
);

CREATE INDEX idx_class_bookings_session ON class_bookings(session_id);
CREATE INDEX idx_class_bookings_member ON class_bookings(member_id);

-- ============================================================
-- Class Waitlists
-- ============================================================
CREATE TABLE IF NOT EXISTS class_waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position INT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, member_id)
);

CREATE INDEX idx_class_waitlists_session ON class_waitlists(session_id);

-- ============================================================
-- Trainer Assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS trainer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'primary',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trainer_id, session_id)
);

CREATE INDEX idx_trainer_assignments_session ON trainer_assignments(session_id);
CREATE INDEX idx_trainer_assignments_trainer ON trainer_assignments(trainer_id);

-- ============================================================
-- Class Attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  check_in_time TIMESTAMPTZ,
  attendance_status VARCHAR(20) NOT NULL DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, member_id)
);

CREATE INDEX idx_class_attendance_session ON class_attendance(session_id);
CREATE INDEX idx_class_attendance_member ON class_attendance(member_id);

-- ============================================================
-- Class Recurring Rules
-- ============================================================
CREATE TABLE IF NOT EXISTS class_recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES class_templates(id) ON DELETE CASCADE,
  days_of_week INT[] NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  trainer_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  studio_id UUID REFERENCES studio_rooms(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  capacity INT,
  repeat_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_rules_template ON class_recurring_rules(template_id);
CREATE INDEX idx_recurring_rules_branch ON class_recurring_rules(branch_id);

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_class_templates_updated_at
  BEFORE UPDATE ON class_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_sessions_updated_at
  BEFORE UPDATE ON class_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
