-- Fix the search_path security issue for functions that don't have it set
-- This addresses the WARN 1: Function Search Path Mutable security warning

-- Fix the handle_new_user function to set search_path properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
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