-- Fix critical security issues from the linter

-- Remove the security definer view and create a regular view instead
DROP VIEW IF EXISTS public.sms_usage_admin_view;

-- Create a function to get masked SMS data for admins
CREATE OR REPLACE FUNCTION public.get_sms_usage_for_admin()
RETURNS TABLE (
  id UUID,
  landlord_id UUID,
  recipient_phone TEXT,
  message_content TEXT,
  cost NUMERIC,
  status TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT has_role(auth.uid(), 'Admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.id,
    s.landlord_id,
    CONCAT('***', RIGHT(s.recipient_phone, 4)) as recipient_phone,
    CONCAT('[', LENGTH(COALESCE(s.message_content, '')), ' characters]') as message_content,
    s.cost,
    s.status,
    s.sent_at,
    s.created_at
  FROM public.sms_usage s;
END;
$$;

-- Fix existing function search paths
DROP FUNCTION IF EXISTS public.insert_sms_usage_secure;
CREATE OR REPLACE FUNCTION public.insert_sms_usage_secure(
  p_landlord_id UUID,
  p_recipient_phone TEXT,
  p_message_content TEXT,
  p_cost NUMERIC,
  p_status TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record_id UUID;
BEGIN
  -- Insert with masked data for security
  INSERT INTO public.sms_usage (
    landlord_id,
    recipient_phone,
    message_content,
    cost,
    status,
    sent_at
  ) VALUES (
    p_landlord_id,
    CONCAT('***', RIGHT(p_recipient_phone, 4)), -- Mask phone number
    CONCAT('[', LENGTH(COALESCE(p_message_content, '')), ' characters]'), -- Mask message content
    p_cost,
    p_status,
    NOW()
  ) RETURNING id INTO v_record_id;
  
  -- Log the action for audit purposes
  INSERT INTO public.user_activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    p_landlord_id,
    'sms_sent',
    'sms_usage',
    v_record_id,
    jsonb_build_object(
      'cost', p_cost,
      'status', p_status,
      'message_length', LENGTH(COALESCE(p_message_content, ''))
    )
  );
  
  RETURN v_record_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_sms_usage_for_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_sms_usage_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_sms_usage_secure TO service_role;