-- Correct plan_type for the marketplace_pro plan that was seeded before plan_type existed
UPDATE public.subscription_plans
SET plan_type = 'marketplace'
WHERE name = 'marketplace_pro';
