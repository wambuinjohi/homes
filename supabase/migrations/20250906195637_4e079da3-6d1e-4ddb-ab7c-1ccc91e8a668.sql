-- Security fixes - Drop and recreate function with proper signature

-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS public.get_user_audit_history(uuid, integer, integer);

-- Create function to get user audit history (for admin operations)
CREATE OR REPLACE FUNCTION public.get_user_audit_history(
  p_user_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  log_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  performed_at timestamp with time zone,
  ip_address inet,
  user_agent text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    id as log_id,
    action,
    entity_type,
    entity_id,
    details,
    performed_at,
    ip_address,
    user_agent
  FROM public.user_activity_logs
  WHERE user_id = p_user_id
  ORDER BY performed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;