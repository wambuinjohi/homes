-- Step 3: Add triggers to automatically set owner_id fields for security

-- Add trigger function to set owner_id automatically for properties
CREATE OR REPLACE FUNCTION public.set_property_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Set owner_id to the authenticated user
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for properties table
DROP TRIGGER IF EXISTS trigger_set_property_owner ON public.properties;
CREATE TRIGGER trigger_set_property_owner
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_property_owner();

-- Add similar function for expenses
CREATE OR REPLACE FUNCTION public.set_expense_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Set created_by to the authenticated user
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for expenses table
DROP TRIGGER IF EXISTS trigger_set_expense_creator ON public.expenses;
CREATE TRIGGER trigger_set_expense_creator
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expense_creator();

-- Add function for tenant announcements
CREATE OR REPLACE FUNCTION public.set_announcement_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Set created_by to the authenticated user
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for tenant announcements
DROP TRIGGER IF EXISTS trigger_set_announcement_creator ON public.tenant_announcements;
CREATE TRIGGER trigger_set_announcement_creator
  BEFORE INSERT ON public.tenant_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_announcement_creator();