-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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