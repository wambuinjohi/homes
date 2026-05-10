-- Add Jenga PAY as a distinct payment method
INSERT INTO approved_payment_methods (
  payment_method_type,
  provider_name,
  country_code,
  is_active,
  configuration
) VALUES (
  'jenga_pay',
  'Jenga PAY (Equity Bank)',
  'KE',
  true,
  jsonb_build_object(
    'display', jsonb_build_object(
      'icon', 'Building2',
      'label', 'Jenga PAY (Equity Bank)',
      'color', 'blue'
    ),
    'paybill_number', '247247',
    'currency', 'KES',
    'description', 'Equity Bank payments via Jenga PAY Gateway',
    'supported_features', json_build_array('ipn_callbacks', 'instant_notifications', 'bank_transfer')
  )
)
ON CONFLICT DO NOTHING;