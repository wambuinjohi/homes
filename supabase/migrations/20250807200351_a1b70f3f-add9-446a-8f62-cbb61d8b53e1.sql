-- ==================================================
-- PHASE 1: DATA CLEANUP & INTEGRITY FIXES
-- ==================================================

-- First, let's fix the immediate issue: David Wanjau should remain a Landlord only
-- Remove the duplicate Tenant role for the user who should be a Landlord
DELETE FROM public.user_roles 
WHERE user_id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d' 
AND role = 'Tenant';

-- ==================================================
-- PHASE 2: EMAIL UNIQUENESS ENFORCEMENT
-- ==================================================

-- Add unique constraint to profiles email (this will prevent duplicate emails)
ALTER TABLE public.profiles 
ADD CONSTRAINT unique_email UNIQUE (email);

-- Make email non-nullable (ensure every user has an email)
ALTER TABLE public.profiles 
ALTER COLUMN email SET NOT NULL;

-- ==================================================
-- PHASE 3: ROLE CHANGE AUDIT LOGGING
-- ==================================================

-- Create role change audit table
CREATE TABLE public.role_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    old_role public.app_role,
    new_role public.app_role NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on role change logs
ALTER TABLE public.role_change_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for role change logs
CREATE POLICY "Admins can manage role change logs"
ON public.role_change_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own role change history"
ON public.role_change_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ==================================================
-- PHASE 4: DUPLICATE DETECTION FUNCTIONS
-- ==================================================

-- Function to detect duplicate emails before insert/update
CREATE OR REPLACE FUNCTION public.check_email_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if email already exists for a different user
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE email = NEW.email 
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Email address % already exists for another user', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce email uniqueness
CREATE TRIGGER enforce_email_uniqueness
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_email_uniqueness();

-- ==================================================
-- PHASE 5: ROLE CHANGE LOGGING FUNCTION
-- ==================================================

-- Function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log role insertions (new roles)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            NEW.user_id, 
            NULL, 
            NEW.role, 
            COALESCE(auth.uid(), NEW.user_id),
            'Role assigned',
            jsonb_build_object(
                'operation', 'INSERT',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log role updates (role changes)
    IF TG_OP = 'UPDATE' THEN
        IF OLD.role != NEW.role THEN
            INSERT INTO public.role_change_logs (
                user_id, old_role, new_role, changed_by, reason, metadata
            ) VALUES (
                NEW.user_id, 
                OLD.role, 
                NEW.role, 
                COALESCE(auth.uid(), NEW.user_id),
                'Role updated',
                jsonb_build_object(
                    'operation', 'UPDATE',
                    'table', 'user_roles',
                    'old_value', OLD.role,
                    'new_value', NEW.role,
                    'timestamp', now()
                )
            );
        END IF;
        RETURN NEW;
    END IF;
    
    -- Log role deletions (role removal)
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.role_change_logs (
            user_id, old_role, new_role, changed_by, reason, metadata
        ) VALUES (
            OLD.user_id, 
            OLD.role, 
            NULL, 
            COALESCE(auth.uid(), OLD.user_id),
            'Role removed',
            jsonb_build_object(
                'operation', 'DELETE',
                'table', 'user_roles',
                'timestamp', now()
            )
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role change logging
CREATE TRIGGER log_user_role_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_role_change();

-- ==================================================
-- PHASE 6: PREVENT DUPLICATE ROLES FOR SAME USER
-- ==================================================

-- Add unique constraint to prevent same user having duplicate roles
ALTER TABLE public.user_roles 
ADD CONSTRAINT unique_user_role UNIQUE (user_id, role);

-- ==================================================
-- PHASE 7: USER CREATION HELPER FUNCTIONS
-- ==================================================

-- Function to safely create user with role (prevents duplicates)
CREATE OR REPLACE FUNCTION public.create_user_safe(
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_role public.app_role
) RETURNS JSONB AS $$
DECLARE
    existing_user_id UUID;
    new_user_id UUID;
    similar_users JSONB;
BEGIN
    -- Check for exact email match
    SELECT id INTO existing_user_id
    FROM public.profiles 
    WHERE email = p_email;
    
    IF existing_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'EMAIL_EXISTS',
            'message', 'A user with this email already exists',
            'existing_user_id', existing_user_id
        );
    END IF;
    
    -- Check for similar users (same phone or name)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'email', email,
            'name', first_name || ' ' || last_name,
            'phone', phone
        )
    ) INTO similar_users
    FROM public.profiles
    WHERE phone = p_phone 
       OR (first_name = p_first_name AND last_name = p_last_name);
    
    -- Create the new user
    new_user_id := gen_random_uuid();
    
    INSERT INTO public.profiles (id, email, first_name, last_name, phone)
    VALUES (new_user_id, p_email, p_first_name, p_last_name, p_phone);
    
    -- Assign the role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, p_role);
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'message', 'User created successfully',
        'similar_users', COALESCE(similar_users, '[]'::jsonb)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLSTATE,
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- PHASE 8: DATA INTEGRITY REPORT FUNCTION
-- ==================================================

-- Function to generate data integrity report
CREATE OR REPLACE FUNCTION public.get_data_integrity_report()
RETURNS JSONB AS $$
DECLARE
    duplicate_emails JSONB;
    multiple_roles JSONB;
    orphaned_roles JSONB;
    recent_role_changes JSONB;
BEGIN
    -- Check for duplicate emails (should be none after our fixes)
    SELECT jsonb_agg(
        jsonb_build_object(
            'email', email,
            'user_count', user_count,
            'users', users
        )
    ) INTO duplicate_emails
    FROM (
        SELECT 
            email,
            COUNT(*) as user_count,
            jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name)) as users
        FROM public.profiles 
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Check for users with multiple roles
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', id,
            'email', email,
            'name', first_name || ' ' || last_name,
            'roles', roles,
            'role_count', role_count
        )
    ) INTO multiple_roles
    FROM (
        SELECT 
            p.id, p.email, p.first_name, p.last_name,
            array_agg(ur.role) as roles,
            COUNT(ur.role) as role_count
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON p.id = ur.user_id
        GROUP BY p.id, p.email, p.first_name, p.last_name
        HAVING COUNT(ur.role) > 1
    ) multi;
    
    -- Check for orphaned roles (roles without profiles)
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', user_id,
            'role', role
        )
    ) INTO orphaned_roles
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON ur.user_id = p.id
    WHERE p.id IS NULL;
    
    -- Get recent role changes
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', user_id,
            'user_email', p.email,
            'user_name', p.first_name || ' ' || p.last_name,
            'old_role', old_role,
            'new_role', new_role,
            'changed_by', changed_by,
            'reason', reason,
            'created_at', created_at
        ) ORDER BY created_at DESC
    ) INTO recent_role_changes
    FROM public.role_change_logs rcl
    LEFT JOIN public.profiles p ON rcl.user_id = p.id
    WHERE created_at >= now() - INTERVAL '7 days'
    LIMIT 20;
    
    RETURN jsonb_build_object(
        'duplicate_emails', COALESCE(duplicate_emails, '[]'::jsonb),
        'multiple_roles', COALESCE(multiple_roles, '[]'::jsonb),
        'orphaned_roles', COALESCE(orphaned_roles, '[]'::jsonb),
        'recent_role_changes', COALESCE(recent_role_changes, '[]'::jsonb),
        'generated_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to admins
GRANT EXECUTE ON FUNCTION public.create_user_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_integrity_report TO authenticated;