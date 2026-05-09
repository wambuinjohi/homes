-- Create service charge invoices table
CREATE TABLE public.service_charge_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_rent_collected NUMERIC NOT NULL DEFAULT 0,
  service_charge_rate NUMERIC NOT NULL DEFAULT 2,
  service_charge_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create landlord payment preferences table
CREATE TABLE public.landlord_payment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL UNIQUE,
  preferred_payment_method TEXT NOT NULL DEFAULT 'mpesa',
  auto_pay_enabled BOOLEAN DEFAULT false,
  payment_day_of_month INTEGER DEFAULT 1 CHECK (payment_day_of_month >= 1 AND payment_day_of_month <= 28),
  notification_enabled BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_charge_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_payment_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_charge_invoices
CREATE POLICY "Landlords can manage their own service charge invoices"
ON public.service_charge_invoices
FOR ALL
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can manage all service charge invoices"
ON public.service_charge_invoices
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- RLS policies for landlord_payment_preferences  
CREATE POLICY "Landlords can manage their own payment preferences"
ON public.landlord_payment_preferences
FOR ALL
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can manage all payment preferences"
ON public.landlord_payment_preferences
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_service_charge_invoices_updated_at
  BEFORE UPDATE ON public.service_charge_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_payment_preferences_updated_at
  BEFORE UPDATE ON public.landlord_payment_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate service invoice numbers
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invoice_number TEXT;
  counter INTEGER;
BEGIN
  -- Get the next counter value for this month
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ '^SVC-[0-9]{6}-[0-9]{4}$' 
      THEN CAST(RIGHT(invoice_number, 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO counter
  FROM public.service_charge_invoices
  WHERE invoice_number LIKE 'SVC-' || TO_CHAR(NOW(), 'YYYYMM') || '-%';
  
  -- Generate the invoice number
  invoice_number := 'SVC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(counter::TEXT, 4, '0');
  
  RETURN invoice_number;
END;
$$;

-- Update country data to Kenya for consistency
UPDATE public.properties 
SET country = 'Kenya' 
WHERE country = 'USA';