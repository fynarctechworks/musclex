-- Add plan_type to subscription_plans (regular = gym, marketplace = service provider)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'regular';

-- Add account_type to studios (gym or marketplace)
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'gym';
