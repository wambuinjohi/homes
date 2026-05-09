-- Update billing plans currency from USD to KES
UPDATE public.billing_plans 
SET currency = 'KES' 
WHERE currency = 'USD';