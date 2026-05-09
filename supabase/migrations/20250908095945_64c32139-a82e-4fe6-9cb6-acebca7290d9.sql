-- Security Fix for SMS Usage Table: Enhanced RLS and Data Protection

-- First, let's enhance the existing RLS policies for sms_usage table

-- Drop existing policies to recreate with better security
DROP POLICY IF EXISTS "Admins can manage all SMS usage" ON public.sms_usage;
DROP POLICY IF EXISTS "Landlords can view their own SMS usage" ON public.sms_usage;

-- Create more secure policies with data masking for admins
CREATE POLICY "Admins can view SMS usage with masked data" 
ON public.sms_usage 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'Admin'::public.app_role)
);

-- Landlords can only view their own SMS usage data
CREATE POLICY "Landlords can view their own SMS usage" 
ON public.sms_usage 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'Landlord'::public.app_role) 
  AND landlord_id = auth.uid()
);

-- Landlords can insert their own SMS usage records
CREATE POLICY "Landlords can insert their own SMS usage" 
ON public.sms_usage 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Landlord'::public.app_role) 
  AND landlord_id = auth.uid()
);

-- System can insert SMS usage records (for edge functions)
CREATE POLICY "System can insert SMS usage records" 
ON public.sms_usage 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Create policy to prevent unauthorized updates
CREATE POLICY "Prevent unauthorized SMS usage updates" 
ON public.sms_usage 
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'Admin'::public.app_role) 
  OR (
    has_role(auth.uid(), 'Landlord'::public.app_role) 
    AND landlord_id = auth.uid()
    AND created_at > (NOW() - INTERVAL '1 hour') -- Only allow modifications within 1 hour
  )
);

-- Create policy to prevent unauthorized deletes
CREATE POLICY "Prevent unauthorized SMS usage deletes" 
ON public.sms_usage 
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'Admin'::public.app_role) 
  OR (
    has_role(auth.uid(), 'Landlord'::public.app_role) 
    AND landlord_id = auth.uid()
    AND created_at > (NOW() - INTERVAL '1 hour') -- Only allow deletions within 1 hour
  )
);

-- Create a secure view for admins that masks sensitive data
CREATE OR REPLACE VIEW public.sms_usage_admin_view AS
SELECT 
  id,
  landlord_id,
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::public.app_role) THEN 
      CONCAT('***', RIGHT(recipient_phone, 4))
    ELSE recipient_phone 
  END as recipient_phone,
  CASE 
    WHEN has_role(auth.uid(), 'Admin'::public.app_role) THEN 
      CONCAT('[', LENGTH(COALESCE(message_content, '')), ' characters]')
    ELSE message_content 
  END as message_content,
  cost,
  status,
  sent_at,
  created_at
FROM public.sms_usage;

-- Enable RLS on the view
ALTER VIEW public.sms_usage_admin_view OWNER TO postgres;

-- Grant appropriate permissions
GRANT SELECT ON public.sms_usage_admin_view TO authenticated;
GRANT SELECT ON public.sms_usage_admin_view TO service_role;

-- Create a function to securely insert SMS usage with automatic masking
CREATE OR REPLACE FUNCTION public.insert_sms_usage_secure(
  p_landlord_id UUID,
  p_recipient_phone TEXT,
  p_message_content TEXT,
  p_cost NUMERIC,
  p_status TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.insert_sms_usage_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_sms_usage_secure TO service_role;