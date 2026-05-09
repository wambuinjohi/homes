-- Create service charge invoices table for tracking landlord billing
CREATE TABLE public.service_charge_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  
  -- Breakdown of charges
  rent_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_charge_rate DECIMAL(5,2), -- percentage rate or fixed amount
  service_charge_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  sms_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Payment details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT,
  payment_reference TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  due_date DATE NOT NULL,
  
  -- Additional details
  notes TEXT,
  currency TEXT NOT NULL DEFAULT 'KES',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_charge_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Landlords can view their own service charge invoices" 
ON public.service_charge_invoices 
FOR SELECT 
USING (landlord_id = auth.uid());

CREATE POLICY "Admins can manage all service charge invoices" 
ON public.service_charge_invoices 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert service charge invoices" 
ON public.service_charge_invoices 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Landlords can update their own invoice payment details" 
ON public.service_charge_invoices 
FOR UPDATE 
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

-- Create function to update updated_at
CREATE TRIGGER update_service_charge_invoices_updated_at
BEFORE UPDATE ON public.service_charge_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create payment methods preferences table for landlords
CREATE TABLE public.landlord_payment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_payment_method TEXT NOT NULL DEFAULT 'mpesa',
  mpesa_phone_number TEXT,
  bank_account_details JSONB,
  auto_payment_enabled BOOLEAN DEFAULT false,
  payment_reminders_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landlord_payment_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Landlords can manage their own payment preferences" 
ON public.landlord_payment_preferences 
FOR ALL 
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can view all payment preferences" 
ON public.landlord_payment_preferences 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_number TEXT;
  current_year TEXT;
  counter INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^SRV-' || current_year || '-\d+$') 
      THEN (regexp_split_to_array(invoice_number, '-'))[3]::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.service_charge_invoices
  WHERE invoice_number LIKE 'SRV-' || current_year || '-%';
  
  invoice_number := 'SRV-' || current_year || '-' || LPAD(counter::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$;

-- Update properties table to fix country consistency
UPDATE public.properties 
SET country = 'Kenya' 
WHERE country = 'USA' AND id IN (
  SELECT p.id 
  FROM properties p
  JOIN landlord_subscriptions ls ON ls.landlord_id = p.owner_id
  JOIN billing_plans bp ON bp.id = ls.billing_plan_id
  WHERE bp.currency = 'KES'
);