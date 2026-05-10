-- Address security warnings that can be fixed via SQL

-- 1. Move extensions out of public schema where possible
-- Note: Some extensions may need to remain in public if they're critical
DO $$
DECLARE
    ext_name text;
BEGIN
    -- List extensions in public schema and move non-critical ones
    FOR ext_name IN 
        SELECT extname 
        FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE n.nspname = 'public'
        AND extname NOT IN ('uuid-ossp', 'pgcrypto', 'pgjwt') -- Keep critical extensions
    LOOP
        -- Try to move extension, but don't fail if it can't be moved
        BEGIN
            EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
        EXCEPTION WHEN OTHERS THEN
            -- Log that we couldn't move this extension
            RAISE NOTICE 'Could not move extension % from public schema: %', ext_name, SQLERRM;
        END;
    END LOOP;
END
$$;

-- 2. Create a function to help with password validation (preparation for manual fixes)
CREATE OR REPLACE FUNCTION public.validate_strong_password(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 3. Add additional security event logging for password-related activities
INSERT INTO public.security_events (event_type, severity, details, created_at)
VALUES 
    ('security_audit', 'low', 
     jsonb_build_object(
         'audit_type', 'password_security_review',
         'recommendations', jsonb_build_array(
             'Enable leaked password protection',
             'Reduce OTP expiry time to 5 minutes',
             'Upgrade PostgreSQL to latest version'
         )
     ), 
     now()
    );

-- 4. Create a security configuration tracking table
CREATE TABLE IF NOT EXISTS public.security_config_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_item text NOT NULL,
    status text NOT NULL,
    last_checked timestamp with time zone DEFAULT now(),
    details jsonb DEFAULT '{}',
    UNIQUE(config_item)
);

-- Track current security configuration status
INSERT INTO public.security_config_status (config_item, status, details)
VALUES 
    ('password_leak_protection', 'disabled', jsonb_build_object('action_required', 'Enable in Supabase Dashboard')),
    ('otp_expiry', 'too_long', jsonb_build_object('action_required', 'Reduce to 300 seconds in Auth settings')),
    ('postgres_version', 'outdated', jsonb_build_object('action_required', 'Upgrade via Supabase Dashboard')),
    ('extensions_in_public', 'partial', jsonb_build_object('action_required', 'Review remaining extensions'))
ON CONFLICT (config_item) DO UPDATE SET
    status = EXCLUDED.status,
    last_checked = EXCLUDED.last_checked,
    details = EXCLUDED.details;