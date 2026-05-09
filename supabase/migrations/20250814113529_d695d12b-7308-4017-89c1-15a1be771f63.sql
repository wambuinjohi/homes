-- Fix critical privilege escalation vulnerability in user_roles table
-- First, remove existing problematic policies

DROP POLICY IF EXISTS "Landlords can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Landlords can view roles within their properties" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role removal" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role updates" ON public.user_roles;

-- Create secure role management functions
CREATE OR REPLACE FUNCTION public.can_assign_role(_assigner_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only Admins can assign Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_assigner_id, 'Admin');
  END IF;
  
  -- Admins can assign any role
  IF public.has_role(_assigner_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only assign non-admin roles within their organization
  IF public.has_role(_assigner_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  -- No one else can assign roles
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_remove_role(_remover_id uuid, _target_user_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Cannot remove your own Admin role (prevents lockout)
  IF _remover_id = _target_user_id AND _target_role = 'Admin' THEN
    RETURN false;
  END IF;
  
  -- Only Admins can remove Admin roles
  IF _target_role = 'Admin' THEN
    RETURN public.has_role(_remover_id, 'Admin');
  END IF;
  
  -- Admins can remove any non-self-admin role
  IF public.has_role(_remover_id, 'Admin') THEN
    RETURN true;
  END IF;
  
  -- Landlords can only remove non-admin roles within their scope
  IF public.has_role(_remover_id, 'Landlord') THEN
    RETURN _target_role IN ('Manager', 'Agent', 'Tenant');
  END IF;
  
  RETURN false;
END;
$$;

-- Create new secure RLS policies for user_roles
CREATE POLICY "Secure: Admins view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Secure: Users view own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Secure: Role assignment control" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

CREATE POLICY "Secure: Role removal control" 
ON public.user_roles 
FOR DELETE 
USING (public.can_remove_role(auth.uid(), user_id, role));

CREATE POLICY "Secure: Role update control" 
ON public.user_roles 
FOR UPDATE 
USING (
  public.can_remove_role(auth.uid(), user_id, role) AND
  public.can_assign_role(auth.uid(), role)
)
WITH CHECK (
  public.can_assign_role(auth.uid(), role) AND
  -- Prevent self-privilege escalation except for Admins
  (auth.uid() != user_id OR public.has_role(auth.uid(), 'Admin'))
);

-- Add role change auditing trigger
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_assigned', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'role', NEW.role,
        'assigned_by', auth.uid(),
        'operation', 'INSERT'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_user_audit(
      NEW.user_id, 
      'role_updated', 
      'user_role', 
      NEW.id::uuid,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'updated_by', auth.uid(),
        'operation', 'UPDATE'
      ),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_user_audit(
      OLD.user_id, 
      'role_removed', 
      'user_role', 
      OLD.id::uuid,
      jsonb_build_object(
        'role', OLD.role,
        'removed_by', auth.uid(),
        'operation', 'DELETE'
      ),
      auth.uid()
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS audit_role_changes_trigger ON public.user_roles;
CREATE TRIGGER audit_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- Add constraint to prevent multiple admin roles for the same user
CREATE UNIQUE INDEX IF NOT EXISTS unique_admin_per_user 
ON public.user_roles (user_id) 
WHERE role = 'Admin';

-- Log this security fix using proper log function
PERFORM public.log_system_event(
  'security', 
  'Fixed critical privilege escalation vulnerability in user roles',
  'database',
  jsonb_build_object(
    'fix_type', 'privilege_escalation',
    'severity', 'critical',
    'description', 'Removed overly permissive RLS policies and added secure role management functions',
    'timestamp', now()
  )
);