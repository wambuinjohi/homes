-- Phase 5: Email Templates RLS + Remaining Function Hardening (Safe)

-- Phase 5a: Email Templates RLS (resolve "Email Templates Could Be Stolen by Competitors")
-- Check if email_templates table exists and enable RLS
DO $$
BEGIN
  -- Enable RLS on email_templates if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_templates') THEN
    -- Enable RLS
    ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any exist to avoid conflicts
    DROP POLICY IF EXISTS "Admins can manage all email templates" ON public.email_templates;
    DROP POLICY IF EXISTS "Landlords can manage their own templates" ON public.email_templates;
    DROP POLICY IF EXISTS "Users can view enabled global templates" ON public.email_templates;
    
    -- Create comprehensive RLS policies for email_templates
    -- 1. Admins can manage all templates
    EXECUTE 'CREATE POLICY "Admins can manage all email templates" ON public.email_templates
      FOR ALL TO authenticated
      USING (has_role(auth.uid(), ''Admin''::app_role))
      WITH CHECK (has_role(auth.uid(), ''Admin''::app_role))';
    
    -- 2. Landlords can manage their own templates  
    EXECUTE 'CREATE POLICY "Landlords can manage their own templates" ON public.email_templates
      FOR ALL TO authenticated
      USING (
        has_role(auth.uid(), ''Landlord''::app_role) AND 
        landlord_id = auth.uid()
      )
      WITH CHECK (
        has_role(auth.uid(), ''Landlord''::app_role) AND 
        landlord_id = auth.uid()
      )';
    
    -- 3. Authenticated users can view enabled global/default templates
    EXECUTE 'CREATE POLICY "Users can view enabled global templates" ON public.email_templates
      FOR SELECT TO authenticated
      USING (
        enabled = true AND 
        landlord_id IS NULL
      )';
    
    -- Revoke any public access from email_templates
    REVOKE ALL ON public.email_templates FROM PUBLIC;
    REVOKE ALL ON public.email_templates FROM anon;
  END IF;
END $$;

-- Phase 5b: Continue Function Search Path Hardening (only functions we know exist)
-- Fix more common functions that are likely to exist

-- Try to fix tenant data functions if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
             WHERE n.nspname = 'public' AND p.proname = 'get_tenant_payments_data') THEN
    ALTER FUNCTION public.get_tenant_payments_data(uuid, integer) SET search_path = public, pg_temp;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
             WHERE n.nspname = 'public' AND p.proname = 'get_tenant_maintenance_data') THEN
    ALTER FUNCTION public.get_tenant_maintenance_data(uuid, integer) SET search_path = public, pg_temp;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
             WHERE n.nspname = 'public' AND p.proname = 'get_tenant_contacts') THEN
    ALTER FUNCTION public.get_tenant_contacts(uuid) SET search_path = public, pg_temp;
  END IF;
  
  -- Plan functions
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
             WHERE n.nspname = 'public' AND p.proname = 'check_plan_feature_access') THEN
    ALTER FUNCTION public.check_plan_feature_access(uuid, text, integer) SET search_path = public, pg_temp;
  END IF;
END $$;

-- Phase 5c: Handle unit_types table RLS (resolve "Property Classification Data Exposed to Public")
DO $$
BEGIN
  -- Enable RLS on unit_types if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unit_types') THEN
    -- Enable RLS
    ALTER TABLE public.unit_types ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any exist
    DROP POLICY IF EXISTS "Authenticated users can view unit types" ON public.unit_types;
    DROP POLICY IF EXISTS "Admins can manage unit types" ON public.unit_types;
    DROP POLICY IF EXISTS "Property managers can manage unit types" ON public.unit_types;
    
    -- Create RLS policies for unit_types
    -- 1. Authenticated users can view unit types (but not anonymous)
    EXECUTE 'CREATE POLICY "Authenticated users can view unit types" ON public.unit_types
      FOR SELECT TO authenticated
      USING (true)';
    
    -- 2. Admins can manage all unit types
    EXECUTE 'CREATE POLICY "Admins can manage unit types" ON public.unit_types
      FOR ALL TO authenticated
      USING (has_role(auth.uid(), ''Admin''::app_role))
      WITH CHECK (has_role(auth.uid(), ''Admin''::app_role))';
    
    -- 3. Landlords can manage unit types
    EXECUTE 'CREATE POLICY "Property managers can manage unit types" ON public.unit_types
      FOR ALL TO authenticated
      USING (has_role(auth.uid(), ''Landlord''::app_role))
      WITH CHECK (has_role(auth.uid(), ''Landlord''::app_role))';
    
    -- Revoke public access
    REVOKE ALL ON public.unit_types FROM PUBLIC;
    REVOKE ALL ON public.unit_types FROM anon;
  END IF;
END $$;