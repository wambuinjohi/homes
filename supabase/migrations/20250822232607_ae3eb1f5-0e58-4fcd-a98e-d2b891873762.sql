-- Drop and recreate the function with proper parameters
DROP FUNCTION IF EXISTS public.log_user_audit(uuid,text,text,uuid,jsonb,uuid,inet,text);

CREATE OR REPLACE FUNCTION public.log_user_audit(
  _user_id uuid,
  _action text,
  _entity_type text,
  _entity_id uuid,
  _details jsonb DEFAULT NULL,
  _performed_by uuid DEFAULT NULL,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.user_audit_logs (
    user_id, action, entity_type, entity_id, details, 
    performed_by, ip_address, user_agent
  ) VALUES (
    _user_id, _action, _entity_type, _entity_id, _details,
    COALESCE(_performed_by, auth.uid(), _user_id), _ip_address, _user_agent
  );
$$;

-- Allow NULL new_role for DELETE operations
ALTER TABLE public.role_change_logs ALTER COLUMN new_role DROP NOT NULL;

-- Now make the David Mwangi changes
DELETE FROM public.user_roles
WHERE user_id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d'::uuid
  AND role = 'Landlord'::public.app_role;

INSERT INTO public.user_roles (user_id, role)
VALUES ('a53f69a5-104e-489b-9b0a-48a56d6b011d'::uuid, 'Tenant'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.tenants
SET email = 'dmwangui@gmail.com'
WHERE id = 'ca46b00f-5532-45b7-b77e-3ae028701d0e'::uuid;