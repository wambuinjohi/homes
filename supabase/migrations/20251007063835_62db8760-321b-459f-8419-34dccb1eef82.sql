-- Create comprehensive SMS logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  phone_number_formatted text NOT NULL, -- E.164 format (254...)
  message_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed, delivered
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  failed_at timestamp with time zone,
  error_message text,
  provider_name text,
  provider_response jsonb,
  landlord_id uuid REFERENCES auth.users(id),
  user_id uuid REFERENCES auth.users(id), -- The user this SMS was about (e.g., new tenant)
  message_type text DEFAULT 'general', -- general, credentials, notification, reminder
  retry_count integer DEFAULT 0,
  last_retry_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all SMS logs
CREATE POLICY "Admins can view all SMS logs" 
ON public.sms_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Admins can update SMS logs (for resend functionality)
CREATE POLICY "Admins can update SMS logs" 
ON public.sms_logs 
FOR UPDATE 
USING (has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- System can insert SMS logs
CREATE POLICY "System can insert SMS logs" 
ON public.sms_logs 
FOR INSERT 
WITH CHECK (true);

-- Landlords can view their own SMS logs
CREATE POLICY "Landlords can view their SMS logs" 
ON public.sms_logs 
FOR SELECT 
USING (landlord_id = auth.uid() OR created_by = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_landlord ON public.sms_logs(landlord_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_user ON public.sms_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON public.sms_logs(phone_number_formatted);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_sms_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sms_logs_updated_at
  BEFORE UPDATE ON public.sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_logs_updated_at();

COMMENT ON TABLE public.sms_logs IS 'Comprehensive SMS logging with status tracking and resend capability';
COMMENT ON COLUMN public.sms_logs.phone_number_formatted IS 'Phone number in E.164 format (254...)';
COMMENT ON COLUMN public.sms_logs.message_type IS 'Type of SMS: general, credentials, notification, reminder';