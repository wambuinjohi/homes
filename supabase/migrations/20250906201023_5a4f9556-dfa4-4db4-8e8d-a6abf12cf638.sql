-- Fix critical security linter issues

-- 1. Enable RLS on tables that might be missing it
DO $$
DECLARE
    table_record record;
BEGIN
    -- Find all tables in public schema without RLS
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (
            SELECT tablename 
            FROM pg_tables t
            JOIN pg_class c ON c.relname = t.tablename
            WHERE c.relrowsecurity = true
            AND schemaname = 'public'
        )
    LOOP
        -- Enable RLS on tables that don't have it
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_record.schemaname, table_record.tablename);
        RAISE NOTICE 'Enabled RLS on %.%', table_record.schemaname, table_record.tablename;
    END LOOP;
END $$;

-- 2. Fix function search paths - set proper search_path on critical functions
-- Update the has_role function to have proper search path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update is_admin function to have proper search path
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text = 'Admin'
  );
$$;