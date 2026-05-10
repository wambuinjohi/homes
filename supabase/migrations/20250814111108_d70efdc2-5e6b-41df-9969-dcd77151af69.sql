-- Fix final database function that needs security update
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN public.generate_invoice_number();
END;
$function$;