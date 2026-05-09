-- Fix the audit functions to handle null authentication properly
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

-- Update role_change_logs to allow null for new_role (for DELETE operations)
ALTER TABLE public.role_change_logs ALTER COLUMN new_role DROP NOT NULL;

-- Fix the audit trigger to handle null auth context
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_assigned', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'role', NEW.role,
        'assigned_by', COALESCE(auth.uid(), NEW.user_id),
        'operation', 'INSERT'
      ),
      COALESCE(auth.uid(), NEW.user_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_user_audit(
      OLD.user_id, 
      'role_removed', 
      'user_role', 
      OLD.id::uuid,
      jsonb_build_object(
        'role', OLD.role,
        'removed_by', COALESCE(auth.uid(), OLD.user_id),
        'operation', 'DELETE'
      ),
      COALESCE(auth.uid(), OLD.user_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

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