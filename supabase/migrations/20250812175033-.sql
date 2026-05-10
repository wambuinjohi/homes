-- 1) Ensure a "Free Trial" billing plan exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_plans WHERE name = 'Free Trial'
  ) THEN
    INSERT INTO public.billing_plans (
      id,
      name,
      description,
      price,
      currency,
      billing_cycle,
      billing_model,
      is_active,
      features,
      sms_credits_included
    ) VALUES (
      gen_random_uuid(),
      'Free Trial',
      'Default free trial plan',
      0,
      'USD',
      'trial',
      'percentage',
      true,
      '[]'::jsonb,
      100
    );
  END IF;
END $$;

-- 2) Create trigger to auto-provision default landlord subscription on role assignment (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_create_default_landlord_subscription'
      AND c.relname = 'user_roles'
  ) THEN
    CREATE TRIGGER trg_create_default_landlord_subscription
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_landlord_subscription();
  END IF;
END $$;