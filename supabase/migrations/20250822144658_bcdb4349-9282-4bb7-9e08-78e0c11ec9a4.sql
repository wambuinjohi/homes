
-- 1) Create landlord-specific M-Pesa credentials table
CREATE TABLE IF NOT EXISTS public.landlord_mpesa_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  consumer_key text NOT NULL,
  consumer_secret text NOT NULL,
  passkey text NOT NULL,
  business_shortcode text NOT NULL,
  phone_number text,
  paybill_number text,
  till_number text,
  environment text NOT NULL DEFAULT 'sandbox',
  callback_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT landlord_mpesa_configs_landlord_unique UNIQUE (landlord_id)
);

-- 2) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_landlord_mpesa_configs_landlord_active
  ON public.landlord_mpesa_configs (landlord_id, is_active);

-- 3) Update timestamp trigger
DROP TRIGGER IF EXISTS trg_landlord_mpesa_configs_updated_at ON public.landlord_mpesa_configs;
CREATE TRIGGER trg_landlord_mpesa_configs_updated_at
BEFORE UPDATE ON public.landlord_mpesa_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RLS: only landlord and Admin can manage
ALTER TABLE public.landlord_mpesa_configs ENABLE ROW LEVEL SECURITY;

-- Admins manage all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'landlord_mpesa_configs' AND policyname = 'Admins can manage landlord M-Pesa configs'
  ) THEN
    CREATE POLICY "Admins can manage landlord M-Pesa configs"
      ON public.landlord_mpesa_configs
      FOR ALL
      USING (has_role(auth.uid(), 'Admin'::public.app_role))
      WITH CHECK (has_role(auth.uid(), 'Admin'::public.app_role));
  END IF;
END$$;

-- Landlords manage their own record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'landlord_mpesa_configs' AND policyname = 'Landlords manage their own M-Pesa config'
  ) THEN
    CREATE POLICY "Landlords manage their own M-Pesa config"
      ON public.landlord_mpesa_configs
      FOR ALL
      USING (landlord_id = auth.uid())
      WITH CHECK (landlord_id = auth.uid());
  END IF;
END$$;
