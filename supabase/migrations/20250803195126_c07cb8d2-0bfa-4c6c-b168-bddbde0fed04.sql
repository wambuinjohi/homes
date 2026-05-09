-- Create email logs table to track all emails sent
CREATE TABLE public.email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email text NOT NULL,
  recipient_user_id uuid,
  sender_email text NOT NULL DEFAULT 'noreply@zirahomes.com',
  subject text NOT NULL,
  template_type text, -- 'welcome', 'payment_reminder', 'maintenance_notice', etc.
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  resend_message_id text, -- Resend's message ID for tracking
  error_message text,
  metadata jsonb, -- Additional data like property_id, tenant_id, etc.
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all email logs" 
ON public.email_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view email logs for their tenants" 
ON public.email_logs 
FOR SELECT 
USING (
  has_role(auth.uid(), 'Landlord'::app_role) OR
  has_role(auth.uid(), 'Manager'::app_role) OR
  has_role(auth.uid(), 'Agent'::app_role)
);

CREATE POLICY "System can insert email logs" 
ON public.email_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update email logs" 
ON public.email_logs 
FOR UPDATE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_template_type ON public.email_logs(template_type);

-- Function to log email sends
CREATE OR REPLACE FUNCTION public.log_email_send(
  _recipient_email text,
  _recipient_user_id uuid DEFAULT NULL,
  _subject text,
  _template_type text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL,
  _resend_message_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.email_logs (
    recipient_email, 
    recipient_user_id, 
    subject, 
    template_type, 
    metadata,
    resend_message_id,
    status,
    sent_at
  ) VALUES (
    _recipient_email, 
    _recipient_user_id, 
    _subject, 
    _template_type, 
    _metadata,
    _resend_message_id,
    'sent',
    now()
  )
  RETURNING id;
$$;