-- Add new billing model columns to billing_plans table
ALTER TABLE public.billing_plans 
ADD COLUMN billing_model text DEFAULT 'percentage',
ADD COLUMN percentage_rate numeric,
ADD COLUMN fixed_amount_per_unit numeric,
ADD COLUMN tier_pricing jsonb,
ADD COLUMN currency text DEFAULT 'USD';

-- Update existing plans to use percentage model
UPDATE public.billing_plans 
SET billing_model = 'percentage', 
    percentage_rate = 2.0,
    currency = 'KES'
WHERE billing_model IS NULL;