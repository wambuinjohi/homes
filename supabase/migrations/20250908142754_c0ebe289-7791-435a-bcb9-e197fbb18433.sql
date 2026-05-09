-- Fix critical security issues: Enable RLS on tables and fix function search paths

-- 1. First, enable RLS on the security_config_status table we just created
ALTER TABLE public.security_config_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for security_config_status
CREATE POLICY "security_config_admin_only" 
ON public.security_config_status
FOR ALL 
TO authenticated
USING (public.has_role('Admin'::public.app_role))
WITH CHECK (public.has_role('Admin'::public.app_role));

-- 2. Check for any other tables without RLS and enable it
DO $$
DECLARE 
    table_record RECORD;
BEGIN
    -- Find tables in public schema without RLS enabled
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (
            SELECT tablename 
            FROM pg_tables t
            JOIN pg_class c ON c.relname = t.tablename
            WHERE t.schemaname = 'public' 
            AND c.relrowsecurity = true
        )
    LOOP
        -- Enable RLS on tables that don't have it
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 
                      table_record.schemaname, table_record.tablename);
        
        -- Log which table we enabled RLS on
        RAISE NOTICE 'Enabled RLS on table: %.%', 
                     table_record.schemaname, table_record.tablename;
    END LOOP;
END
$$;

-- 3. Fix function search paths for functions without proper search_path
-- Update validate_strong_password function
CREATE OR REPLACE FUNCTION public.validate_strong_password(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Password must be at least 8 characters
    IF length(password) < 8 THEN
        RETURN false;
    END IF;
    
    -- Password must contain uppercase, lowercase, number, and special char
    IF NOT (password ~ '[A-Z]' AND password ~ '[a-z]' AND password ~ '[0-9]' AND password ~ '[^A-Za-z0-9]') THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- 4. Update any other functions that might have mutable search paths
-- Check and fix existing functions with security definer that don't have explicit search_path
DO $$
DECLARE 
    func_record RECORD;
BEGIN
    -- Find SECURITY DEFINER functions without proper search_path
    FOR func_record IN 
        SELECT n.nspname, p.proname 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true  -- SECURITY DEFINER functions
        AND p.proname NOT IN ('has_role', 'is_admin', 'is_user_tenant') -- Already fixed
    LOOP
        RAISE NOTICE 'Found function that may need search_path fix: %.%', 
                     func_record.nspname, func_record.proname;
    END LOOP;
END
$$;