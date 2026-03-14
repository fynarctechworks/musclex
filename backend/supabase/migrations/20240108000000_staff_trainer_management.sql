-- Migration: Staff & Trainer Management Enhancements
-- Creates tables for staff shifts, leave requests, payroll records,
-- and trainer performance records.

-- ============================================================
-- Staff Shifts
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  shift_date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  shift_type VARCHAR(20) NOT NULL DEFAULT 'regular',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_shifts_staff_date ON staff_shifts(staff_id, shift_date);
CREATE INDEX idx_staff_shifts_branch_date ON staff_shifts(branch_id, shift_date);

-- ============================================================
-- Leave Requests
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_requests_staff_status ON leave_requests(staff_id, status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- ============================================================
-- Payroll Records (Pay Runs)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  salary_period_start DATE NOT NULL,
  salary_period_end DATE NOT NULL,
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonus DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission DECIMAL(10,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_paid DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_records_staff_period ON payroll_records(staff_id, salary_period_start);
CREATE INDEX idx_payroll_records_status ON payroll_records(status);

-- ============================================================
-- Trainer Performance Records (Snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS trainer_performance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  total_sessions INT NOT NULL DEFAULT 0,
  completed_sessions INT NOT NULL DEFAULT 0,
  cancelled_sessions INT NOT NULL DEFAULT 0,
  active_clients INT NOT NULL DEFAULT 0,
  member_ratings DECIMAL(3,2) NOT NULL DEFAULT 0,
  revenue_generated DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  utilization_rate INT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainer_perf_trainer_period ON trainer_performance_records(trainer_id, period_start);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER set_updated_at_staff_shifts
  BEFORE UPDATE ON staff_shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_leave_requests
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
