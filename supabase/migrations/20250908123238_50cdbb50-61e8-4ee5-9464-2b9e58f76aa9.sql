-- Phase 5: Email Templates RLS + Unit Types RLS (Targeted Fix)

-- First, let's check and enable RLS on email_templates if the table exists
DO $$
BEGIN
  -- Enable RLS on email_templates if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates' AND table_schema = 'public') THEN
    ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any exist
    DROP POLICY IF EXISTS "Admins can manage all email templates" ON public.email_templates;
    DROP POLICY IF EXISTS "Landlords can manage their own templates" ON public.email_templates;
    DROP POLICY IF EXISTS "Users can view enabled global templates" ON public.email_templates;

    -- Create comprehensive RLS policies for email_templates
    -- 1. Admins can manage all templates
    CREATE POLICY "Admins can manage all email templates" ON public.email_templates
      FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'Admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

    -- 2. Landlords can manage their own templates (if landlord_id column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'landlord_id' AND table_schema = 'public') THEN
      CREATE POLICY "Landlords can manage their own templates" ON public.email_templates
        FOR ALL TO authenticated
        USING (
          has_role(auth.uid(), 'Landlord'::app_role) AND 
          landlord_id = auth.uid()
        )
        WITH CHECK (
          has_role(auth.uid(), 'Landlord'::app_role) AND 
          landlord_id = auth.uid()
        );
    END IF;

    -- 3. Authenticated users can view enabled global/default templates
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'enabled' AND table_schema = 'public') THEN
      CREATE POLICY "Users can view enabled global templates" ON public.email_templates
        FOR SELECT TO authenticated
        USING (
          enabled = true AND 
          (landlord_id IS NULL OR has_role(auth.uid(), 'Admin'::app_role))
        );
    ELSE
      -- Fallback policy if enabled column doesn't exist
      CREATE POLICY "Users can view global templates" ON public.email_templates
        FOR SELECT TO authenticated
        USING (landlord_id IS NULL OR has_role(auth.uid(), 'Admin'::app_role));
    END IF;

    -- Revoke any public access from email_templates
    REVOKE ALL ON public.email_templates FROM PUBLIC;
    REVOKE ALL ON public.email_templates FROM anon;
  END IF;
END $$;

-- Also secure unit_types table (mentioned in scanner findings)
DO $$
BEGIN
  -- Enable RLS on unit_types if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unit_types' AND table_schema = 'public') THEN
    ALTER TABLE public.unit_types ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any exist
    DROP POLICY IF EXISTS "Authenticated users can view unit types" ON public.unit_types;
    DROP POLICY IF EXISTS "Property managers can manage unit types" ON public.unit_types;

    -- Create RLS policies for unit_types
    -- 1. Authenticated users can view unit types
    CREATE POLICY "Authenticated users can view unit types" ON public.unit_types
      FOR SELECT TO authenticated
      USING (true);

    -- 2. Admins and landlords can manage unit types
    CREATE POLICY "Property managers can manage unit types" ON public.unit_types
      FOR ALL TO authenticated
      USING (
        has_role(auth.uid(), 'Admin'::app_role) OR 
        has_role(auth.uid(), 'Landlord'::app_role)
      )
      WITH CHECK (
        has_role(auth.uid(), 'Admin'::app_role) OR 
        has_role(auth.uid(), 'Landlord'::app_role)
      );

    -- Revoke public access from unit_types
    REVOKE ALL ON public.unit_types FROM PUBLIC;
    REVOKE ALL ON public.unit_types FROM anon;
  END IF;
END $$;

-- Try to move any remaining extensions that might still be in public
DO $$
BEGIN
  -- Move any remaining extensions if they exist
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'plpgsql' AND schemaname = 'public') THEN
    -- Note: plpgsql usually can't be moved, it's built-in
    NULL;
  END IF;
END $$;