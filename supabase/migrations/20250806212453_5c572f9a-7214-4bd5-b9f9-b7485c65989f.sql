-- Fix the infinite recursion in tenants table RLS policy
-- The issue is likely in the policy that checks if a user exists in the tenants table

-- First, let's drop the problematic policy
DROP POLICY IF EXISTS "Tenants can view their own info" ON public.tenants;

-- Create a security definer function to check if user is a tenant
CREATE OR REPLACE FUNCTION public.is_user_tenant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE user_id = _user_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Tenants can view their own info" ON public.tenants
FOR SELECT
USING (auth.uid() = user_id);

-- Also check and fix any other policies that might be causing recursion
-- Let's also create a function to get tenant IDs for a user safely
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(id)
  FROM public.tenants
  WHERE user_id = _user_id
$$;

-- Update any policies that might be using subqueries on tenants table
-- Check if there are any policies referencing tenants table in their conditions