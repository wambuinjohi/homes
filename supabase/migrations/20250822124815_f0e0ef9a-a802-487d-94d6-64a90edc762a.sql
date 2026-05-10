
-- 1) Allow 'perpetual' as a valid billing_cycle
ALTER TABLE public.billing_plans
  DROP CONSTRAINT IF EXISTS billing_plans_billing_cycle_check;

ALTER TABLE public.billing_plans
  ADD CONSTRAINT billing_plans_billing_cycle_check
  CHECK (billing_cycle IN ('monthly','quarterly','annual','perpetual'));

-- 2) Insert a non-public "Perpetual License" plan (admins can assign; landlords won't see it among active plans)
INSERT INTO public.billing_plans (
  name,
  description,
  price,
  billing_cycle,
  max_properties,
  max_units,
  sms_credits_included,
  features,
  is_active,
  currency
)
SELECT
  'Perpetual License',
  'Lifetime access - price negotiated with Zira Management',
  0,
  'perpetual',
  -1,
  -1,
  0,
  '["Lifetime access","No recurring billing","Priority support"]'::jsonb,
  false,      -- keep hidden from landlords; admins still see/manage
  'USD'
WHERE NOT EXISTS (
  SELECT 1 FROM public.billing_plans WHERE lower(name) = 'perpetual license'
);
