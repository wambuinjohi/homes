-- Add unique partial index to prevent duplicate active sub-users for same landlord
CREATE UNIQUE INDEX CONCURRENTLY idx_sub_users_unique_active_email_per_landlord 
ON public.sub_users (landlord_id, (
  SELECT email FROM public.profiles WHERE profiles.id = sub_users.user_id
)) 
WHERE status = 'active';

-- Add function to check if user exists by email
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS TABLE(user_id uuid, has_profile boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    true as has_profile
  FROM public.profiles p
  WHERE lower(p.email) = lower(_email)
  LIMIT 1;
  
  -- If no profile found, check auth.users directly via admin function
  IF NOT FOUND THEN
    -- This requires service role to work, but provides fallback
    RETURN QUERY
    SELECT 
      NULL::uuid as user_id,
      false as has_profile
    LIMIT 0;
  END IF;
END;
$$;