-- Add payment_instructions column to landlord_payment_preferences if it doesn't exist
ALTER TABLE public.landlord_payment_preferences 
ADD COLUMN IF NOT EXISTS payment_instructions text;