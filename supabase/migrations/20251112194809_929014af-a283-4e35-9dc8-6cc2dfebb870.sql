-- Fix generate_invoice_number function to use correct year formatting
-- Bug: TO_CHAR(EXTRACT(YEAR FROM CURRENT_DATE), 'YYYY') returns 'YYYY' as a literal string
-- Fix: Use EXTRACT(YEAR FROM CURRENT_DATE)::text to get the actual year

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    next_id bigint;
    current_year text;
BEGIN
    -- Get current year as text
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
    
    -- Get the next sequence value
    SELECT nextval('public.invoice_number_seq') INTO next_id;
    
    -- Generate invoice number with proper formatting: INV-2025-000001
    RETURN 'INV-' || current_year || '-' || LPAD(next_id::text, 6, '0');
END;
$function$;

-- Update existing invoices with YYYY in their numbers to use current year (2025)
UPDATE public.invoices
SET invoice_number = REPLACE(invoice_number, 'INV-YYYY-', 'INV-2025-')
WHERE invoice_number LIKE 'INV-YYYY-%';