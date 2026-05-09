-- Update tenant_account_creation to be for all users, not just tenants
UPDATE communication_preferences 
SET setting_name = 'user_account_creation',
    description = 'Communication method when creating new user accounts (all roles)'
WHERE setting_name = 'tenant_account_creation';

-- Add new communication preference for general user account creation if needed
INSERT INTO communication_preferences (setting_name, description, email_enabled, sms_enabled)
VALUES ('user_account_creation', 'Communication method when creating new user accounts (all roles)', true, true)
ON CONFLICT (setting_name) DO NOTHING;