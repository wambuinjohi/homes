-- Create table for pre-approved payment methods by country
CREATE TABLE public.approved_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  payment_method_type TEXT NOT NULL, -- 'mpesa', 'card', 'bank_transfer', etc.
  provider_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  configuration JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approved_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage approved payment methods" 
ON public.approved_payment_methods 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view approved payment methods" 
ON public.approved_payment_methods 
FOR SELECT 
USING (has_role(auth.uid(), 'Landlord'::app_role));

-- Insert default approved payment methods for Kenya
INSERT INTO public.approved_payment_methods (country_code, payment_method_type, provider_name, configuration) VALUES
('KE', 'mpesa', 'M-Pesa', '{"currency": "KES", "supported_features": ["stk_push", "c2b"]}'),
('KE', 'card', 'Stripe', '{"currency": "KES", "supported_cards": ["visa", "mastercard"]}'),
('KE', 'bank_transfer', 'KCB Bank', '{"currency": "KES", "transfer_types": ["rtgs", "eft"]}'),
('KE', 'bank_transfer', 'Equity Bank', '{"currency": "KES", "transfer_types": ["rtgs", "eft"]}'),
('US', 'card', 'Stripe', '{"currency": "USD", "supported_cards": ["visa", "mastercard", "amex"]}'),
('US', 'bank_transfer', 'ACH', '{"currency": "USD", "transfer_types": ["ach"]}');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_approved_payment_methods_updated_at
BEFORE UPDATE ON public.approved_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();