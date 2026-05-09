-- COMPREHENSIVE SECURITY FIX: Part 6 - Fix ALL Functions with Mutable Search Paths
-- This addresses the remaining Function Search Path Mutable warnings

-- Fix all remaining functions that don't have search_path configured
-- Based on the query results, these functions need to be updated:

CREATE OR REPLACE FUNCTION public.activate_user(_user_id uuid, _performed_by uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'active', 'User activated', v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'active',
    reason = 'User activated',
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  PERFORM public.log_user_audit(
    _user_id, 'activate', 'user', _user_id,
    jsonb_build_object('reason', 'User activated'),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User activated successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_user(_user_id uuid, _reason text DEFAULT 'Administrative action'::text, _performed_by uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'suspended', _reason, v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'suspended',
    reason = _reason,
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  PERFORM public.log_user_audit(
    _user_id, 'suspend', 'user', _user_id,
    jsonb_build_object('reason', _reason),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User suspended successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Clean up rate limit entries older than 24 hours
  DELETE FROM public.rate_limits 
  WHERE created_at < now() - interval '24 hours';
END;
$$;