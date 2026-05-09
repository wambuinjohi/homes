
-- 1) Add custom pricing columns
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_link text;

-- 2) Backfill: mark Enterprise plans as custom and set a sensible default contact link
UPDATE public.billing_plans
SET is_custom = true,
    contact_link = COALESCE(contact_link, '/support?topic=enterprise')
WHERE lower(name) LIKE 'enterprise%';
