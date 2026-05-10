-- Fix critical security issues with proper existence checks

-- 1. Enable RLS on security_config_status if not already enabled, and create policy if needed
DO $$
BEGIN
    -- Check if RLS is already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'security_config_status' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE public.security_config_status ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Create policy only if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_config_status' 
        AND policyname = 'security_config_admin_only'
    ) THEN
        CREATE POLICY "security_config_admin_only" 
        ON public.security_config_status
        FOR ALL 
        TO authenticated
        USING (public.has_role('Admin'::public.app_role))
        WITH CHECK (public.has_role('Admin'::public.app_role));
    END IF;
END
$$;

-- 2. Check for any other tables without RLS and enable it safely
DO $$
DECLARE 
    table_record RECORD;
    rls_enabled boolean;
BEGIN
    -- Find tables in public schema that might not have RLS enabled
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'  -- Skip system tables
        AND tablename NOT LIKE 'auth_%' -- Skip auth tables
        AND tablename NOT LIKE 'supabase_%' -- Skip supabase tables
    LOOP
        -- Check if RLS is enabled for this specific table
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class 
        WHERE relname = table_record.tablename;
        
        -- Enable RLS if not already enabled
        IF NOT COALESCE(rls_enabled, false) THEN
            EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 
                          table_record.schemaname, table_record.tablename);
            
            RAISE NOTICE 'Enabled RLS on table: %.%', 
                         table_record.schemaname, table_record.tablename;
        END IF;
    END LOOP;
END
$$;

-- 3. Create default RLS policies for tables that might not have proper policies
-- This helps ensure no tables are completely inaccessible

-- Create a safe default policy for any tables that might be missing policies
DO $$
DECLARE 
    table_name text;
    policy_count integer;
BEGIN
    -- Check specific tables that should have policies
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename IN ('user_roles', 'rate_limits', 'system_logs')
    LOOP
        -- Count existing policies for this table
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = table_name;
        
        -- If no policies exist, create a restrictive default one
        IF policy_count = 0 THEN
            CASE table_name
                WHEN 'user_roles' THEN
                    EXECUTE format('CREATE POLICY "user_roles_admin_only" ON public.%I FOR ALL TO authenticated USING (public.has_role(''Admin''::public.app_role))', table_name);
                WHEN 'rate_limits' THEN  
                    EXECUTE format('CREATE POLICY "rate_limits_system_only" ON public.%I FOR ALL TO authenticated USING (false)', table_name);
                WHEN 'system_logs' THEN
                    EXECUTE format('CREATE POLICY "system_logs_admin_only" ON public.%I FOR SELECT TO authenticated USING (public.has_role(''Admin''::public.app_role))', table_name);
            END CASE;
            
            RAISE NOTICE 'Created default RLS policy for table: %', table_name;
        END IF;
    END LOOP;
END
$$;