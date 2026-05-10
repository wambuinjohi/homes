-- Create function to get transaction status
CREATE OR REPLACE FUNCTION public.get_transaction_status(p_checkout_request_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT status 
  FROM public.mpesa_transactions 
  WHERE checkout_request_id = p_checkout_request_id
  LIMIT 1;
$function$