-- Add M-Pesa transaction tracking to service charge invoices
ALTER TABLE public.service_charge_invoices 
ADD COLUMN IF NOT EXISTS mpesa_checkout_request_id text,
ADD COLUMN IF NOT EXISTS mpesa_receipt_number text,
ADD COLUMN IF NOT EXISTS payment_phone_number text;

-- Create automated billing settings table
CREATE TABLE IF NOT EXISTS public.automated_billing_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  billing_day_of_month integer NOT NULL DEFAULT 1,
  grace_period_days integer NOT NULL DEFAULT 7,
  auto_payment_enabled boolean NOT NULL DEFAULT false,
  notification_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automated_billing_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage automated billing settings
CREATE POLICY "Admins can manage automated billing settings"
ON public.automated_billing_settings
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Insert default automated billing settings
INSERT INTO public.automated_billing_settings (enabled, billing_day_of_month, grace_period_days)
VALUES (true, 1, 7)
ON CONFLICT DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_automated_billing_settings_updated_at
BEFORE UPDATE ON public.automated_billing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();