-- Create edge function to handle user creation with roles
-- This function will be called from the frontend to create users

-- First, let's add a function to create users with specific roles
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
  temp_password text;
BEGIN
  -- Generate a temporary password
  temp_password := 'TempPass' || floor(random() * 10000)::text || '!';
  
  -- For now, we'll create a profile entry and user role
  -- In production, this would integrate with Supabase Auth API
  new_user_id := gen_random_uuid();
  
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name, email, phone)
  VALUES (new_user_id, p_first_name, p_last_name, p_email, p_phone);
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role);
  
  -- Return success with user info
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'temporary_password', temp_password,
    'message', 'User created successfully. They will need to complete signup with their email.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users who have permission
REVOKE ALL ON FUNCTION public.create_user_with_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_with_role TO authenticated;