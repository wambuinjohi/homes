-- Fix remaining functions without SET search_path
-- This includes some critical functions that need hardening

-- Fix check_email_uniqueness function
CREATE OR REPLACE FUNCTION public.check_email_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Fix log_role_change function
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;