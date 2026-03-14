-- Create studio_template schema
CREATE SCHEMA IF NOT EXISTS studio_template;

-- PUBLIC SCHEMA: studios table
CREATE TABLE IF NOT EXISTS public.studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  schema_name TEXT UNIQUE NOT NULL,
  owner_user_id UUID NOT NULL,
  logo_url TEXT,
  tagline TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  business_name TEXT,
  business_type TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency TEXT NOT NULL DEFAULT 'INR',
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  billing_name TEXT,
  billing_email TEXT,
  billing_address TEXT,
  tax_id TEXT,
  subscription_start TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PUBLIC SCHEMA: subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  annual_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_branches INTEGER NOT NULL DEFAULT 1,
  max_members INTEGER NOT NULL DEFAULT 100,
  max_staff INTEGER NOT NULL DEFAULT 5,
  storage_limit_gb INTEGER NOT NULL DEFAULT 1,
  api_access BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PUBLIC SCHEMA: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id),
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_studio_created ON public.invoices(studio_id, created_at);

-- PUBLIC SCHEMA: email_verifications
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PUBLIC SCHEMA: pending_registrations
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  code_expires_at TIMESTAMPTZ NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STUDIO_TEMPLATE SCHEMA: branches
CREATE TABLE IF NOT EXISTS studio_template.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- members
CREATE TABLE IF NOT EXISTS studio_template.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code TEXT UNIQUE NOT NULL,
  branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  profile_photo_url TEXT,
  face_descriptor DOUBLE PRECISION[] DEFAULT '{}',
  checkin_method TEXT NOT NULL DEFAULT 'manual',
  qr_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  engagement_score INTEGER NOT NULL DEFAULT 0,
  churn_risk TEXT NOT NULL DEFAULT 'low',
  referral_code TEXT UNIQUE,
  referred_by_member_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE studio_template.members ADD CONSTRAINT members_referred_by_fk FOREIGN KEY (referred_by_member_id) REFERENCES studio_template.members(id);

-- membership_plans
CREATE TABLE IF NOT EXISTS studio_template.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES studio_template.branches(id),
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL,
  duration_days INTEGER,
  total_classes INTEGER,
  max_classes_per_week INTEGER,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_renew_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- member_memberships
CREATE TABLE IF NOT EXISTS studio_template.member_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES studio_template.members(id),
  plan_id UUID NOT NULL REFERENCES studio_template.membership_plans(id),
  branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
  start_date DATE NOT NULL,
  end_date DATE,
  classes_remaining INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  freeze_start_date DATE,
  freeze_end_date DATE,
  freeze_reason TEXT,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  payment_method_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- staff
CREATE TABLE IF NOT EXISTS studio_template.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  branch_ids UUID[] DEFAULT '{}',
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  specializations TEXT[] DEFAULT '{}',
  salary DECIMAL(10,2),
  performance_score INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- classes
CREATE TABLE IF NOT EXISTS studio_template.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
  trainer_id UUID NOT NULL REFERENCES studio_template.staff(id),
  substitute_trainer_id UUID REFERENCES studio_template.staff(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  room TEXT,
  capacity INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  recurrence_rule TEXT,
  recurrence_end_date DATE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- check_ins
CREATE TABLE IF NOT EXISTS studio_template.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES studio_template.members(id),
  membership_id UUID NOT NULL REFERENCES studio_template.member_memberships(id),
  branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
  class_id UUID REFERENCES studio_template.classes(id),
  checkin_method TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'success',
  failure_reason TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- class_enrollments
CREATE TABLE IF NOT EXISTS studio_template.class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES studio_template.classes(id),
  member_id UUID NOT NULL REFERENCES studio_template.members(id),
  status TEXT NOT NULL DEFAULT 'enrolled',
  waitlist_position INTEGER,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payments
CREATE TABLE IF NOT EXISTS studio_template.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES studio_template.members(id),
  membership_id UUID REFERENCES studio_template.member_memberships(id),
  branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  gateway_payment_id TEXT,
  gateway_order_id TEXT,
  receipt_number TEXT UNIQUE NOT NULL,
  invoice_url TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- expenses
CREATE TABLE IF NOT EXISTS studio_template.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES studio_template.branches(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  recorded_by_staff_id UUID NOT NULL REFERENCES studio_template.staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications_log
CREATE TABLE IF NOT EXISTS studio_template.notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES studio_template.members(id),
  channel TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  external_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- campaigns
CREATE TABLE IF NOT EXISTS studio_template.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT NOT NULL,
  segment_filters JSONB,
  channels TEXT[] DEFAULT '{}',
  message_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  created_by_staff_id UUID NOT NULL REFERENCES studio_template.staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ai_conversations
CREATE TABLE IF NOT EXISTS studio_template.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES studio_template.staff(id),
  messages JSONB NOT NULL,
  context_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- roles
CREATE TABLE IF NOT EXISTS studio_template.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- audit_logs
CREATE TABLE IF NOT EXISTS studio_template.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
