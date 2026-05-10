-- CRITICAL SECURITY FIXES

-- 1. Fix invoice_overview view - recreate as SECURITY INVOKER to prevent cross-tenant exposure
DROP VIEW IF EXISTS public.invoice_overview;

CREATE VIEW public.invoice_overview 
WITH (security_invoker = true) AS
SELECT 
  i.id,
  i.lease_id,
  i.tenant_id,
  i.invoice_date,
  i.due_date,
  i.amount,
  i.created_at,
  i.updated_at,
  i.invoice_number,
  i.status,
  i.description,
  
  -- Payment calculations
  COALESCE(pa.amount_paid_allocated, 0) as amount_paid_allocated,
  COALESCE(pd.amount_paid_direct, 0) as amount_paid_direct,
  COALESCE(pa.amount_paid_allocated, 0) + COALESCE(pd.amount_paid_direct, 0) as amount_paid_total,
  GREATEST(i.amount - (COALESCE(pa.amount_paid_allocated, 0) + COALESCE(pd.amount_paid_direct, 0)), 0) as outstanding_amount,
  
  -- Property and tenant info
  p.id as property_id,
  p.owner_id as property_owner_id,
  p.manager_id as property_manager_id,
  p.name as property_name,
  u.unit_number,
  t.first_name,
  t.last_name,
  t.email,
  t.phone,
  
  -- Computed status
  CASE 
    WHEN i.amount <= (COALESCE(pa.amount_paid_allocated, 0) + COALESCE(pd.amount_paid_direct, 0)) THEN 'paid'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    ELSE i.status
  END as computed_status

FROM public.invoices i
JOIN public.leases l ON i.lease_id = l.id
JOIN public.units u ON l.unit_id = u.id
JOIN public.properties p ON u.property_id = p.id
LEFT JOIN public.tenants t ON i.tenant_id = t.id
LEFT JOIN (
  SELECT invoice_id, SUM(amount) as amount_paid_allocated
  FROM public.payment_allocations
  GROUP BY invoice_id
) pa ON i.id = pa.invoice_id
LEFT JOIN (
  SELECT invoice_id, SUM(amount) as amount_paid_direct
  FROM public.payments
  WHERE status IN ('completed', 'paid', 'success') AND invoice_id IS NOT NULL
  GROUP BY invoice_id
) pd ON i.id = pd.invoice_id;

-- 2. Fix get_user_permissions RPC to prevent permission leakage
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(permission_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Force the user to only query their own permissions
  SELECT p.name as permission_name
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = COALESCE(_user_id, auth.uid())
    AND ur.user_id = auth.uid(); -- CRITICAL: Only allow querying own permissions
$$;

-- 3. Restrict mpesa_transactions insert policy
DROP POLICY IF EXISTS "System can insert transactions" ON public.mpesa_transactions;
CREATE POLICY "Authenticated users can insert transactions"
ON public.mpesa_transactions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Add encrypted M-Pesa credentials table
CREATE TABLE IF NOT EXISTS public.landlord_mpesa_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid NOT NULL,
  consumer_key_encrypted text,
  consumer_secret_encrypted text,
  shortcode_encrypted text,
  passkey_encrypted text,
  callback_url text,
  environment text NOT NULL DEFAULT 'sandbox',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_landlord_mpesa UNIQUE(landlord_id)
);

-- Enable RLS on new table
ALTER TABLE public.landlord_mpesa_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for encrypted M-Pesa configs
CREATE POLICY "Landlords manage their M-Pesa configs"
ON public.landlord_mpesa_configs
FOR ALL
USING (landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::public.app_role))
WITH CHECK (landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::public.app_role));

-- Trigger to set landlord_id automatically
CREATE OR REPLACE FUNCTION public.set_mpesa_config_landlord_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.landlord_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_mpesa_config_landlord_id_trigger
  BEFORE INSERT ON public.landlord_mpesa_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mpesa_config_landlord_id();

-- Update trigger for timestamps
CREATE TRIGGER update_landlord_mpesa_configs_updated_at
  BEFORE UPDATE ON public.landlord_mpesa_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Fix search_path in all SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_property_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_expense_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_announcement_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

-- 6. Add security event logging for critical operations
CREATE OR REPLACE FUNCTION public.log_security_event(_event_type text, _severity text DEFAULT 'medium', _details jsonb DEFAULT '{}', _user_id uuid DEFAULT auth.uid(), _ip_address inet DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  INSERT INTO public.security_events (event_type, severity, details, user_id, ip_address)
  VALUES (_event_type, _severity, _details, _user_id, _ip_address);
$$;