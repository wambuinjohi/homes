-- Update RLS policies to allow Landlords to view and manage all profiles and user roles
-- This is needed so Landlords can see the team members they create

-- Drop existing restrictive policies and create more inclusive ones
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Create new policies that include Landlords
CREATE POLICY "Admins and Landlords can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
);

CREATE POLICY "Admins and Landlords can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role) OR
  auth.uid() = user_id
);

CREATE POLICY "Admins and Landlords can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
);

-- Also need to allow Landlords to insert profiles when creating users
CREATE POLICY "Admins and Landlords can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'Admin'::app_role) OR 
  has_role(auth.uid(), 'Landlord'::app_role)
);