-- Add platform configuration to billing_settings table
-- This makes hardcoded values like M-Pesa shortcode, phone validation, and payment defaults configurable

-- Platform M-Pesa Configuration
INSERT INTO billing_settings (setting_key, setting_value, description)
VALUES (
  'platform_mpesa_config',
  jsonb_build_object(
    'shortcode', '4155923',
    'environment', 'sandbox',
    'display_name', 'Platform M-Pesa',
    'shortcode_type', 'paybill',
    'account_reference', 'Required'
  ),
  'Platform-wide M-Pesa configuration used as default for landlords'
)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    updated_at = now();

-- Phone Validation Rules by Country
INSERT INTO billing_settings (setting_key, setting_value, description)
VALUES (
  'phone_validation_rules',
  jsonb_build_object(
    'KE', jsonb_build_object(
      'regex', '^\+254[0-9]{9}$',
      'format', '+254XXXXXXXXX',
      'placeholder', '+254712345678',
      'country_code', '+254',
      'display_name', 'Kenya'
    ),
    'UG', jsonb_build_object(
      'regex', '^\+256[0-9]{9}$',
      'format', '+256XXXXXXXXX',
      'placeholder', '+256712345678',
      'country_code', '+256',
      'display_name', 'Uganda'
    ),
    'TZ', jsonb_build_object(
      'regex', '^\+255[0-9]{9}$',
      'format', '+255XXXXXXXXX',
      'placeholder', '+255712345678',
      'country_code', '+255',
      'display_name', 'Tanzania'
    )
  ),
  'Phone number validation rules and formatting by country'
)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    updated_at = now();

-- Default Payment Methods by Country
INSERT INTO billing_settings (setting_key, setting_value, description)
VALUES (
  'default_payment_methods',
  jsonb_build_object(
    'KE', 'mpesa',
    'UG', 'bank_transfer',
    'TZ', 'mpesa',
    'default', 'bank_transfer'
  ),
  'Default payment method to suggest based on user country'
)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    updated_at = now();

-- Update approved_payment_methods with display metadata
UPDATE approved_payment_methods
SET configuration = jsonb_set(
  COALESCE(configuration, '{}'::jsonb),
  '{display}',
  jsonb_build_object(
    'icon', CASE 
      WHEN payment_method_type = 'mpesa' THEN 'Smartphone'
      WHEN payment_method_type = 'bank_transfer' THEN 'Building2'
      WHEN payment_method_type = 'cash' THEN 'Banknote'
      WHEN payment_method_type = 'cheque' THEN 'FileText'
      ELSE 'CreditCard'
    END,
    'label', CASE 
      WHEN payment_method_type = 'mpesa' THEN 'M-Pesa'
      WHEN payment_method_type = 'bank_transfer' THEN 'Bank Transfer'
      WHEN payment_method_type = 'cash' THEN 'Cash'
      WHEN payment_method_type = 'cheque' THEN 'Cheque'
      ELSE payment_method_type
    END,
    'color', CASE 
      WHEN payment_method_type = 'mpesa' THEN 'green'
      WHEN payment_method_type = 'bank_transfer' THEN 'blue'
      WHEN payment_method_type = 'cash' THEN 'yellow'
      WHEN payment_method_type = 'cheque' THEN 'purple'
      ELSE 'gray'
    END
  )
)
WHERE configuration IS NULL OR configuration->'display' IS NULL;