
-- 1) Make David (user_id a53f69a5-104e-489b-9b0a-48a56d6b011d) a Tenant only

-- Assign Tenant role if not already present
INSERT INTO public.user_roles (user_id, role)
SELECT 'a53f69a5-104e-489b-9b0a-48a56d6b011d'::uuid, 'Tenant'::public.app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d'::uuid 
    AND role = 'Tenant'::public.app_role
);

-- Remove Landlord role if present
DELETE FROM public.user_roles
WHERE user_id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d'::uuid
  AND role = 'Landlord'::public.app_role;

-- 2) Align the tenant email with the user's profile email (email as unique identifier)
UPDATE public.tenants
SET email = 'dmwangui@gmail.com'
WHERE id = 'ca46b00f-5532-45b7-b77e-3ae028701d0e'::uuid;

-- 3) Prevent future conflicting roles (Landlord + Tenant) on the same user
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
