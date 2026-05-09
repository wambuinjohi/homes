
-- 1) Ensure columns exist on landlord_payment_preferences (only if the table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'landlord_payment_preferences'
  ) THEN
    ALTER TABLE public.landlord_payment_preferences
      ADD COLUMN IF NOT EXISTS preferred_payment_method text NOT NULL DEFAULT 'mpesa',
      ADD COLUMN IF NOT EXISTS mpesa_phone_number text,
      ADD COLUMN IF NOT EXISTS bank_account_details jsonb,
      ADD COLUMN IF NOT EXISTS payment_instructions text,
      ADD COLUMN IF NOT EXISTS auto_payment_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_reminders_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    -- Ensure quick lookup by landlord
    CREATE UNIQUE INDEX IF NOT EXISTS landlord_payment_preferences_landlord_id_idx
      ON public.landlord_payment_preferences(landlord_id);
  END IF;
END
$$;

-- 2) Create per‑landlord M‑Pesa credential store
CREATE TABLE IF NOT EXISTS public.landlord_mpesa_configs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id        uuid NOT NULL,
  consumer_key       text NOT NULL,
  consumer_secret    text NOT NULL,
  passkey            text NOT NULL,
  business_shortcode text NOT NULL,
  phone_number       text,
  paybill_number     text,
  till_number        text,
  environment        text NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
  callback_url       text,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- FK to public.profiles (avoid referencing auth.users directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'landlord_mpesa_configs_landlord_fk'
  ) THEN
    ALTER TABLE public.landlord_mpesa_configs
      ADD CONSTRAINT landlord_mpesa_configs_landlord_fk
      FOREIGN KEY (landlord_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Unique per landlord (active config)
CREATE UNIQUE INDEX IF NOT EXISTS landlord_mpesa_configs_landlord_idx
  ON public.landlord_mpesa_configs(landlord_id) WHERE is_active;

-- Keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_landlord_mpesa_configs_updated_at'
  ) THEN
    CREATE TRIGGER trg_landlord_mpesa_configs_updated_at
      BEFORE UPDATE ON public.landlord_mpesa_configs
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- Enable RLS and add policies
ALTER TABLE public.landlord_mpesa_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admins manage all
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='landlord_mpesa_configs' AND policyname='Admins can manage all mpesa configs'
  ) THEN
    CREATE POLICY "Admins can manage all mpesa configs"
      ON public.landlord_mpesa_configs
      FOR ALL
      USING (has_role(auth.uid(), 'Admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));
  END IF;

  -- Landlords manage their own config
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='landlord_mpesa_configs' AND policyname='Landlords manage their own mpesa config'
  ) THEN
    CREATE POLICY "Landlords manage their own mpesa config"
      ON public.landlord_mpesa_configs
      FOR ALL
      USING (landlord_id = auth.uid())
      WITH CHECK (landlord_id = auth.uid());
  END IF;
END
$$;
