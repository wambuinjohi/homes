-- Make phone numbers required for SMS communication
-- First, let's set a default phone number for existing users without one
UPDATE public.profiles 
SET phone = '+000000000000' 
WHERE phone IS NULL OR phone = '';

-- Now make the phone field required
ALTER TABLE public.profiles 
ALTER COLUMN phone SET NOT NULL;

-- Add a check constraint to ensure phone numbers are properly formatted
ALTER TABLE public.profiles 
ADD CONSTRAINT phone_format_check 
CHECK (phone ~ '^\+[1-9]\d{1,14}$');

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
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, '+000000000000'),
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