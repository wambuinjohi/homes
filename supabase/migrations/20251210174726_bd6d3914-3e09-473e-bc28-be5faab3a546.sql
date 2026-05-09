-- Add missing currency fields to jenga_ipn_callbacks table
ALTER TABLE public.jenga_ipn_callbacks 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES',
ADD COLUMN IF NOT EXISTS order_currency TEXT DEFAULT 'KES';

-- Add comment for documentation
COMMENT ON COLUMN public.jenga_ipn_callbacks.currency IS 'Transaction currency from Jenga IPN (e.g., KES)';
COMMENT ON COLUMN public.jenga_ipn_callbacks.order_currency IS 'Original order currency from Jenga IPN';