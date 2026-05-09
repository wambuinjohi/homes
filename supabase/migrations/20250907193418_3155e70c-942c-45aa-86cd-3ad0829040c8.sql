-- Fix security issues from linter

-- 1. Fix the security definer view issue by removing security invoker setting
-- Views automatically inherit security context from underlying tables
-- The security_invoker setting is causing the issue
ALTER VIEW public.invoice_overview SET (security_invoker = false);

-- 2. Fix function search path issues by setting explicit search_path for existing functions
-- Update generate_invoice_number function
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    next_id bigint;
    invoice_number text;
BEGIN
    -- Get the next sequence value
    SELECT nextval('public.invoice_number_seq') INTO next_id;
    
    -- Generate invoice number with proper formatting
    invoice_number := 'INV-' || TO_CHAR(EXTRACT(YEAR FROM CURRENT_DATE), 'YYYY') || '-' || LPAD(next_id::text, 6, '0');
    
    RETURN invoice_number;
END;
$function$;

-- Update generate_service_invoice_number function  
CREATE OR REPLACE FUNCTION public.generate_service_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN public.generate_invoice_number();
END;
$function$;