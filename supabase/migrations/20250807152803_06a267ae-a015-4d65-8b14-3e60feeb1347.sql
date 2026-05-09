-- Update Simon Gichuki's role from Manager to Landlord
UPDATE user_roles 
SET role = 'Landlord'
WHERE user_id = '23054b29-a494-42f2-bb35-d1bdf9cfdfcb' 
  AND role = 'Manager';

-- Also ensure he has a landlord payment preferences record
INSERT INTO landlord_payment_preferences (landlord_id, preferred_payment_method, payment_reminders_enabled)
VALUES ('23054b29-a494-42f2-bb35-d1bdf9cfdfcb', 'mpesa', true)
ON CONFLICT (landlord_id) DO NOTHING;