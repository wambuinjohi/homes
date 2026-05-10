-- First fix the role_change_logs table to allow NULL new_role for DELETE operations
ALTER TABLE public.role_change_logs ALTER COLUMN new_role DROP NOT NULL;

-- Now make the changes to David's data
DELETE FROM public.user_roles
WHERE user_id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d'::uuid
  AND role = 'Landlord'::public.app_role;

INSERT INTO public.user_roles (user_id, role)
VALUES ('a53f69a5-104e-489b-9b0a-48a56d6b011d'::uuid, 'Tenant'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.tenants
SET email = 'dmwangui@gmail.com'
WHERE id = 'ca46b00f-5532-45b7-b77e-3ae028701d0e'::uuid;

-- Add the conflict prevention function
CREATE OR REPLACE FUNCTION public.prevent_conflicting_landlord_tenant_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO ''
AS $$
BEGIN
  IF NEW.role IN ('Landlord','Tenant') THEN
    IF EXISTS (
      SELECT 1 
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.user_id
        AND ur.role IN ('Landlord','Tenant')
        AND ur.role <> NEW.role
    ) THEN
      RAISE EXCEPTION 'A user cannot have both Landlord and Tenant roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_conflicting_roles ON public.user_roles;
CREATE TRIGGER trg_prevent_conflicting_roles
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_conflicting_landlord_tenant_roles();