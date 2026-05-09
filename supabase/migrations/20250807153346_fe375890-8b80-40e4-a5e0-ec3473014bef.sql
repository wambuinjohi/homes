-- Update Simon Gichuki's auth metadata to reflect correct Landlord role
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"Landlord"'
)
WHERE id = '23054b29-a494-42f2-bb35-d1bdf9cfdfcb';