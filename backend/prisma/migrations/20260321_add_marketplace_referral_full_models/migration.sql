-- Add missing fields to Studios (public schema)
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- ================================================================
-- PUBLIC SCHEMA: B2B Referral System
-- ================================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_studio_id UUID NOT NULL REFERENCES public.studios(id),
  referred_studio_id UUID NOT NULL UNIQUE REFERENCES public.studios(id),
  referral_code TEXT NOT NULL,
  referred_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT UNIQUE,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_studio_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

CREATE TABLE IF NOT EXISTS public.referral_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.referral_campaigns(id),
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  rewards JSONB NOT NULL DEFAULT '[]',
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses INT,
  uses_count INT NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reward_rules_campaign ON public.referral_reward_rules(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_rules_active ON public.referral_reward_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_reward_rules_priority ON public.referral_reward_rules(priority);

CREATE TABLE IF NOT EXISTS public.reward_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id),
  rule_id UUID NOT NULL REFERENCES public.referral_reward_rules(id),
  beneficiary_studio_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}',
  reward_type TEXT NOT NULL,
  reward_value JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  subscription_extended_from TIMESTAMPTZ,
  subscription_extended_to TIMESTAMPTZ,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reward_logs_referral ON public.reward_logs(referral_id);
CREATE INDEX IF NOT EXISTS idx_reward_logs_rule ON public.reward_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_reward_logs_beneficiary ON public.reward_logs(beneficiary_studio_id);
CREATE INDEX IF NOT EXISTS idx_reward_logs_status ON public.reward_logs(status);

-- ================================================================
-- STUDIO_TEMPLATE SCHEMA: Marketplace Models
-- ================================================================

CREATE TABLE IF NOT EXISTS studio_template.service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  gym_id UUID,
  business_name TEXT NOT NULL,
  description TEXT,
  specializations TEXT[] DEFAULT '{}',
  experience_years INT NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10, 2),
  verification_status TEXT NOT NULL DEFAULT 'pending',
  rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  total_reviews INT NOT NULL DEFAULT 0,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  city TEXT,
  country TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  average_rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  profile_photo_url TEXT,
  portfolio_urls TEXT[] DEFAULT '{}',
  certifications JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_svc_providers_user ON studio_template.service_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_svc_providers_gym ON studio_template.service_providers(gym_id);
CREATE INDEX IF NOT EXISTS idx_svc_providers_verified ON studio_template.service_providers(verification_status);
CREATE INDEX IF NOT EXISTS idx_svc_providers_active ON studio_template.service_providers(is_active);

CREATE TABLE IF NOT EXISTS studio_template.service_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES studio_template.service_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_svc_catalogs_provider ON studio_template.service_catalogs(provider_id);
CREATE INDEX IF NOT EXISTS idx_svc_catalogs_category ON studio_template.service_catalogs(category);

CREATE TABLE IF NOT EXISTS studio_template.service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES studio_template.service_providers(id),
  requester_id UUID NOT NULL,
  service_id UUID,
  service_name TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'requested',
  notes TEXT,
  cancellation_reason TEXT,
  completed_at TIMESTAMPTZ,
  availability_slot_id TEXT,
  estimated_cost DECIMAL(10, 2),
  final_cost DECIMAL(10, 2),
  cancelled_by UUID,
  started_at TIMESTAMPTZ,
  rating INT,
  chat_room_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_svc_bookings_gym ON studio_template.service_bookings(gym_id);
CREATE INDEX IF NOT EXISTS idx_svc_bookings_provider ON studio_template.service_bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_svc_bookings_requester ON studio_template.service_bookings(requester_id);
CREATE INDEX IF NOT EXISTS idx_svc_bookings_status ON studio_template.service_bookings(status);

CREATE TABLE IF NOT EXISTS studio_template.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES studio_template.service_bookings(id),
  provider_id UUID NOT NULL REFERENCES studio_template.service_providers(id),
  reviewer_id UUID NOT NULL,
  reviewer_name TEXT,
  rating INT NOT NULL,
  title TEXT,
  content TEXT,
  comment TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count INT NOT NULL DEFAULT 0,
  unhelpful_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON studio_template.reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON studio_template.reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON studio_template.reviews(rating);

CREATE TABLE IF NOT EXISTS studio_template.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES studio_template.service_bookings(id),
  provider_id UUID NOT NULL REFERENCES studio_template.service_providers(id),
  gym_id UUID NOT NULL,
  gym_user_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chats_provider ON studio_template.chats(provider_id);
CREATE INDEX IF NOT EXISTS idx_chats_gym ON studio_template.chats(gym_id);

CREATE TABLE IF NOT EXISTS studio_template.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES studio_template.chats(id) ON DELETE CASCADE,
  chat_room_id UUID,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  text TEXT,
  attachments JSONB DEFAULT '[]',
  seen_by TEXT[] DEFAULT '{}',
  seen_at TIMESTAMPTZ,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_chat ON studio_template.chat_messages(chat_id, created_at);

CREATE TABLE IF NOT EXISTS studio_template.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recipient_id UUID,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  message TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  related_entity_id TEXT,
  related_entity_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON studio_template.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON studio_template.notifications(created_at);

CREATE TABLE IF NOT EXISTS studio_template.provider_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL UNIQUE REFERENCES studio_template.service_providers(id) ON DELETE CASCADE,
  plan_id UUID,
  plan_name TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  monthly_price DECIMAL(10, 2),
  billing_cycle TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  lead_limit INT,
  enabled_features JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add availability_slot relation support
ALTER TABLE studio_template.provider_availability_slots ADD COLUMN IF NOT EXISTS id_new TEXT;
