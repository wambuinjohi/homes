-- Fix function search path security issues by updating existing functions
-- This addresses the "Function Search Path Mutable" security warnings

-- Update functions that don't have SET search_path = '' for security
-- These functions need to be recreated with proper security settings

-- 1. Fix the has_role function (if it exists without proper search path)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 2. Fix other security-sensitive functions that may be missing search_path

-- Update the get_trial_status function
CREATE OR REPLACE FUNCTION public.get_trial_status(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  v_grace_days integer := 7;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription, return null
  IF subscription_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return current status if not trial-related
  IF subscription_record.status NOT IN ('trial', 'trial_expired', 'suspended') THEN
    RETURN subscription_record.status;
  END IF;
  
  -- Determine grace period per subscription
  v_grace_days := COALESCE(subscription_record.grace_period_days, 7);
  
  -- Check trial status based on dates
  IF subscription_record.trial_end_date IS NULL THEN
    RETURN 'trial';
  END IF;
  
  -- Active trial
  IF now() <= subscription_record.trial_end_date THEN
    RETURN 'trial';
  END IF;
  
  -- Grace period
  IF now() <= (subscription_record.trial_end_date + make_interval(days => v_grace_days)) THEN
    RETURN 'trial_expired';
  END IF;
  
  -- Suspended after grace period
  RETURN 'suspended';
END;
$$;

-- Update the check_trial_limitation function
CREATE OR REPLACE FUNCTION public.check_trial_limitation(_user_id uuid, _feature text, _current_count integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subscription_record RECORD;
  feature_limit integer;
BEGIN
  -- Get subscription info
  SELECT * INTO subscription_record
  FROM public.landlord_subscriptions
  WHERE landlord_id = _user_id;
  
  -- If no subscription or not on trial, allow
  IF subscription_record IS NULL OR subscription_record.status != 'trial' THEN
    RETURN true;
  END IF;
  
  -- Check if trial is expired
  IF subscription_record.trial_end_date < now() THEN
    RETURN false;
  END IF;
  
  -- Get feature limit from trial_limitations
  feature_limit := (subscription_record.trial_limitations ->> _feature)::integer;
  
  -- If no limit set, allow
  IF feature_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if current count exceeds limit
  RETURN _current_count <= feature_limit;
END;
$$;

-- Update the is_user_tenant function
CREATE OR REPLACE FUNCTION public.is_user_tenant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE user_id = _user_id
  )
$$;

-- Update the get_user_tenant_ids function
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(id)
  FROM public.tenants
  WHERE user_id = _user_id
$$;

-- Update the get_tenant_unit_ids function
CREATE OR REPLACE FUNCTION public.get_tenant_unit_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT l.unit_id)
  FROM public.leases l
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

-- Update the get_tenant_property_ids function
CREATE OR REPLACE FUNCTION public.get_tenant_property_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT u.property_id)
  FROM public.units u
  JOIN public.leases l ON l.unit_id = u.id
  JOIN public.tenants t ON t.id = l.tenant_id
  WHERE t.user_id = _user_id;
$$;

-- Update the can_user_manage_tenant function
CREATE OR REPLACE FUNCTION public.can_user_manage_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = _tenant_id 
      AND (p.owner_id = _user_id OR p.manager_id = _user_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'Admin'
  );
$$;

-- Update the get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_name text, category text, description text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT p.name, p.category, p.description
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = _user_id
  ORDER BY p.category, p.name
$$;

-- Update the get_transaction_status function
CREATE OR REPLACE FUNCTION public.get_transaction_status(p_checkout_request_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT status 
  FROM public.mpesa_transactions 
  WHERE checkout_request_id = p_checkout_request_id
  LIMIT 1;
$$;

-- Comment on the security improvement
COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 
'Security: Function updated with SET search_path = '''' to prevent search path attacks';

COMMENT ON FUNCTION public.get_trial_status(uuid) IS 
'Security: Function updated with SET search_path = '''' to prevent search path attacks';

COMMENT ON FUNCTION public.check_trial_limitation(uuid, text, integer) IS 
'Security: Function updated with SET search_path = '''' to prevent search path attacks';