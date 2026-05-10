-- Add garbage_deposit column to units table
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS garbage_deposit numeric(10,2) DEFAULT NULL;