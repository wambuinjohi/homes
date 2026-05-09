-- Fix leases table to have proper defaults and constraints
ALTER TABLE public.leases 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Update existing leases with NULL or empty status to 'active'
UPDATE public.leases 
SET status = 'active' 
WHERE status IS NULL OR status = '';

-- Create landlord-specific M-Pesa configuration table
CREATE TABLE IF NOT EXISTS public.landlord_mpesa_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id uuid NOT NULL,
  consumer_key text NOT NULL,
  consumer_secret text NOT NULL,
  shortcode text NOT NULL,
  passkey text NOT NULL,
  callback_url text,
  is_active boolean NOT NULL DEFAULT true,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(landlord_id)
);

-- Enable RLS on landlord_mpesa_configs
ALTER TABLE public.landlord_mpesa_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for landlord_mpesa_configs
CREATE POLICY "Landlords can manage their own M-Pesa configs" 
ON public.landlord_mpesa_configs 
FOR ALL 
USING (landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_landlord_mpesa_configs_updated_at
BEFORE UPDATE ON public.landlord_mpesa_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure invoices use the proper invoice number generation
ALTER TABLE public.invoices 
ALTER COLUMN invoice_number SET DEFAULT generate_invoice_number();