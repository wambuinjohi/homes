-- Add unique constraint to prevent duplicate active sub-users for same landlord and user
CREATE UNIQUE INDEX CONCURRENTLY idx_sub_users_unique_active_landlord_user 
ON public.sub_users (landlord_id, user_id) 
WHERE status = 'active';

-- Add function to check if user exists by email and get their profile info
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS TABLE(user_id uuid, has_profile boolean, first_name text, last_name text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    true as has_profile,
    p.first_name,
    p.last_name,
    p.phone
  FROM public.profiles p
  WHERE lower(p.email) = lower(_email)
  LIMIT 1;
END;
$$;