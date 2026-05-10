-- PART 1: Role Unification - Consolidate all property-related roles to 'landlord'

-- First, update existing role enum to include new sub-user role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'landlord_subuser';

-- Update all existing property-related roles to 'landlord'
UPDATE public.user_roles 
SET role = 'Landlord'::app_role 
WHERE role IN ('Manager', 'Agent', 'Property_Owner', 'Property_Manager');

-- Create sub_users table for landlord delegation system
CREATE TABLE IF NOT EXISTS public.sub_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{"manage_properties": false, "manage_tenants": false, "manage_leases": false, "manage_maintenance": false, "view_reports": false}'::jsonb,
  title text, -- Partner, Agent, Manager, etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(parent_landlord_id, sub_user_id)
);

-- Enable RLS on sub_users table
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for sub_users table
CREATE POLICY "Landlords can manage their sub-users"
ON public.sub_users
FOR ALL
USING (
  parent_landlord_id = auth.uid() AND 
  has_role(auth.uid(), 'Landlord'::app_role)
)
WITH CHECK (
  parent_landlord_id = auth.uid() AND 
  has_role(auth.uid(), 'Landlord'::app_role)
);

CREATE POLICY "Sub-users can view their own record"
ON public.sub_users
FOR SELECT
USING (
  sub_user_id = auth.uid() AND 
  has_role(auth.uid(), 'landlord_subuser'::app_role)
);

CREATE POLICY "Admins can manage all sub-users"
ON public.sub_users
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create function to get parent landlord ID for sub-users
CREATE OR REPLACE FUNCTION public.get_parent_landlord_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT parent_landlord_id
  FROM public.sub_users
  WHERE sub_user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- Create function to check if user is a sub-user
CREATE OR REPLACE FUNCTION public.is_sub_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sub_users
    WHERE sub_user_id = _user_id AND is_active = true
  );
$$;

-- Create function to check sub-user permissions
CREATE OR REPLACE FUNCTION public.has_sub_user_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (permissions ->> _permission)::boolean,
    false
  )
  FROM public.sub_users
  WHERE sub_user_id = _user_id AND is_active = true;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_sub_users_updated_at
BEFORE UPDATE ON public.sub_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create activity log table for sub-user actions
CREATE TABLE IF NOT EXISTS public.sub_user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on activity logs
ALTER TABLE public.sub_user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity logs
CREATE POLICY "Landlords can view their sub-user activity logs"
ON public.sub_user_activity_logs
FOR SELECT
USING (
  parent_landlord_id = auth.uid() AND 
  has_role(auth.uid(), 'Landlord'::app_role)
);

CREATE POLICY "System can insert activity logs"
ON public.sub_user_activity_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all activity logs"
ON public.sub_user_activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'Admin'::app_role));