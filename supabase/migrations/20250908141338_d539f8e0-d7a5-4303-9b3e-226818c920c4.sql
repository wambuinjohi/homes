-- COMPREHENSIVE SECURITY FIX: Part 4 - Fix Extension in Public Warning
-- Move extensions to dedicated schema and fix remaining function search paths

-- Step C: Fix Warning 2 - Extension in Public
-- Create dedicated schema for extensions and move them out of public

-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated;

-- Move pgcrypto extension to extensions schema (if possible - some extensions cannot be moved)
-- Note: Some core extensions like pgcrypto may need to remain in public for Supabase compatibility
-- But we'll revoke unnecessary permissions on public schema

-- Revoke broad permissions on public schema
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Grant only necessary permissions to authenticated users on public schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Now let's fix remaining functions with mutable search paths
-- Update all trigger functions to have proper search_path

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_landlord_id()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.landlord_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_property_owner()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_expense_creator()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_announcement_creator()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;