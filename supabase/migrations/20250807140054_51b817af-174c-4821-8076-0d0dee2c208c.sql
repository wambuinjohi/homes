-- Add payment_type and metadata columns to mpesa_transactions table
ALTER TABLE public.mpesa_transactions 
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'rent',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;