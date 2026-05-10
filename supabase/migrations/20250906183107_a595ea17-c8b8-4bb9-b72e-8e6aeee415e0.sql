-- Add unique constraint to prevent duplicate active sub-users per landlord-user combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_users_landlord_user_active 
ON public.sub_users (landlord_id, user_id) 
WHERE status = 'active';

-- Add comment for documentation
COMMENT ON INDEX idx_sub_users_landlord_user_active IS 'Ensures a user can only be an active sub-user once per landlord';