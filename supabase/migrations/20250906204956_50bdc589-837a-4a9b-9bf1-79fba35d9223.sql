-- SECURITY FIX: Create database function for secure M-Pesa credential insertion
CREATE OR REPLACE FUNCTION public.set_mpesa_landlord_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Set landlord_id to the authenticated user for inserts
  NEW.landlord_id := auth.uid();
  RETURN NEW;
END;
$function$;

-- Create trigger for M-Pesa credentials table
DROP TRIGGER IF EXISTS mpesa_credentials_set_landlord_id_trigger ON public.mpesa_credentials;
CREATE TRIGGER mpesa_credentials_set_landlord_id_trigger
  BEFORE INSERT ON public.mpesa_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mpesa_landlord_id();

-- Add the same trigger for landlord_mpesa_configs if it exists
DROP TRIGGER IF EXISTS landlord_mpesa_configs_set_landlord_id_trigger ON public.landlord_mpesa_configs;
CREATE TRIGGER landlord_mpesa_configs_set_landlord_id_trigger
  BEFORE INSERT ON public.landlord_mpesa_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mpesa_landlord_id();

-- SECURITY FIX: Create log_security_event RPC function for secure logging
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _severity text DEFAULT 'medium'::text,
  _details jsonb DEFAULT '{}'::jsonb,
  _user_id uuid DEFAULT NULL::uuid,
  _ip_address inet DEFAULT NULL::inet
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.security_events (
    event_type,
    severity,
    details,
    user_id,
    ip_address,
    user_agent
  ) VALUES (
    _event_type,
    _severity,
    _details,
    COALESCE(_user_id, auth.uid()),
    _ip_address,
    COALESCE(
      (_details->>'user_agent')::text,
      current_setting('request.headers', true)::jsonb->>'user-agent'
    )
  );
END;
$function$;

-- SECURITY FIX: Ensure all SECURITY DEFINER functions have proper search_path
-- Update existing functions to include SET search_path TO ''

-- Update has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

-- Update can_assign_role function  
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only Admins can assign Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_assigner_id, 'Admin');
  END IF;
  
  -- Admins can assign any role
  IF public.has_role(_assigner_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only assign non-admin roles
  IF public.has_role(_assigner_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  -- No one else can assign roles
  RETURN false;
END;
$function$;

-- SECURITY FIX: Create function to check if current user is admin (for UI gating)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.has_role(_user_id, 'Admin'::public.app_role);
$function$;