-- Continue security fixes for remaining database functions

-- Update update_service_invoice_updated_at function
CREATE OR REPLACE FUNCTION public.update_service_invoice_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Update set_announcement_creator function  
CREATE OR REPLACE FUNCTION public.set_announcement_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Set created_by to the authenticated user
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$function$;