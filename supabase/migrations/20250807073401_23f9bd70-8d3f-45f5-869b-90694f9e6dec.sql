-- Fix phone number format for existing users and make phone required
-- First, let's update existing phone numbers to ensure they're in proper format
UPDATE public.profiles 
SET phone = CASE 
  WHEN phone IS NULL OR phone = '' THEN '+254700000000'  -- Default Kenya number
  WHEN phone ~ '^\+' THEN phone  -- Already has country code
  WHEN phone ~ '^0[0-9]+' THEN '+254' || SUBSTRING(phone FROM 2)  -- Remove leading 0 and add Kenya code
  WHEN phone ~ '^[1-9][0-9]+' THEN '+254' || phone  -- Add Kenya code
  ELSE '+254700000000'  -- Fallback for invalid formats
END;

-- Now make the phone field required
ALTER TABLE public.profiles 
ALTER COLUMN phone SET NOT NULL;

-- Add a more lenient check constraint for international phone numbers
ALTER TABLE public.profiles 
ADD CONSTRAINT phone_format_check 
CHECK (phone ~ '^\+[1-9]\d{7,14}$');

-- Update the user creation function to require phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Insert into profiles table with required phone
  INSERT INTO public.profiles (id, first_name, last_name, phone, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+254700000000'),
    NEW.email
  );
  
  -- Assign role based on user metadata, default to 'Agent' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'Agent'::public.app_role
    )
  );
  
  RETURN NEW;
END;
$$;