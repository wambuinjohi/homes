-- Fix remaining security issues: search paths for functions

-- Fix get_user_permissions function search path
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(permission_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $$
  -- Force the user to only query their own permissions
  SELECT p.name as permission_name
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = COALESCE(_user_id, auth.uid())
    AND ur.user_id = auth.uid(); -- CRITICAL: Only allow querying own permissions
$$;

-- Fix has_role function search path
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
  );
$$;

-- Fix get_sms_usage_for_admin function search path (it was still using public)
CREATE OR REPLACE FUNCTION public.get_sms_usage_for_admin()
RETURNS TABLE (
  id UUID,
  landlord_id UUID,
  recipient_phone TEXT,
  message_content TEXT,
  cost NUMERIC,
  status TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT public.has_role(auth.uid(), 'Admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.id,
    s.landlord_id,
    CONCAT('***', RIGHT(s.recipient_phone, 4)) as recipient_phone,
    CONCAT('[', LENGTH(COALESCE(s.message_content, '')), ' characters]') as message_content,
    s.cost,
    s.status,
    s.sent_at,
    s.created_at
  FROM public.sms_usage s;
END;
$$;