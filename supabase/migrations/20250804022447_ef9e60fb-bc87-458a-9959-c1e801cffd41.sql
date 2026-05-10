-- Fix the landlord maintenance dashboard by assigning properties to landlords
-- First, let's see what users we have and assign properties appropriately

-- Update existing properties to have proper ownership
-- Assign the first few properties to the current landlord user
UPDATE public.properties 
SET owner_id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d'
WHERE owner_id IS NULL 
LIMIT 3;

-- Assign remaining properties to any other landlord/admin users if they exist
UPDATE public.properties 
SET owner_id = (
  SELECT ur.user_id 
  FROM public.user_roles ur 
  WHERE ur.role IN ('Landlord', 'Admin') 
  AND ur.user_id != 'a53f69a5-104e-489b-9b0a-48a56d6b011d'
  LIMIT 1
)
WHERE owner_id IS NULL;

-- If there are still unassigned properties, assign them to any user with Landlord role
UPDATE public.properties 
SET owner_id = (
  SELECT ur.user_id 
  FROM public.user_roles ur 
  WHERE ur.role = 'Landlord'
  LIMIT 1
)
WHERE owner_id IS NULL;

-- Add a constraint to ensure properties must have either an owner or manager
ALTER TABLE public.properties 
ADD CONSTRAINT properties_must_have_owner_or_manager 
CHECK (owner_id IS NOT NULL OR manager_id IS NOT NULL);