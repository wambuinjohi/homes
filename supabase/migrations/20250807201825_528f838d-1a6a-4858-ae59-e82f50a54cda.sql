CREATE OR REPLACE FUNCTION public.get_data_integrity_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
            'user_id', rcl.user_id,
            'user_email', p.email,
            'user_name', p.first_name || ' ' || p.last_name,
            'old_role', rcl.old_role,
            'new_role', rcl.new_role,
            'changed_by', rcl.changed_by,
            'reason', rcl.reason,
            'created_at', rcl.created_at
        ) ORDER BY rcl.created_at DESC
    ) INTO recent_role_changes
    FROM public.role_change_logs rcl
    LEFT JOIN public.profiles p ON rcl.user_id = p.id
    WHERE rcl.created_at >= now() - INTERVAL '7 days'
    LIMIT 20;
    
    RETURN jsonb_build_object(
        'duplicate_emails', COALESCE(duplicate_emails, '[]'::jsonb),
        'multiple_roles', COALESCE(multiple_roles, '[]'::jsonb),
        'orphaned_roles', COALESCE(orphaned_roles, '[]'::jsonb),
        'recent_role_changes', COALESCE(recent_role_changes, '[]'::jsonb),
        'generated_at', now()
    );
END;
$function$