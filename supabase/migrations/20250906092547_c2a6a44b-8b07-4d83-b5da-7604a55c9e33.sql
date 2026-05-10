-- Create a helper function for creating M-Pesa configs
CREATE OR REPLACE FUNCTION public.create_landlord_mpesa_config(
  p_consumer_key text,
  p_consumer_secret text,
  p_business_shortcode text,
  p_passkey text,
  p_callback_url text DEFAULT NULL,
  p_environment text DEFAULT 'sandbox',
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_id uuid;
BEGIN
  INSERT INTO public.landlord_mpesa_configs (
    landlord_id,
    consumer_key,
    consumer_secret,
    business_shortcode,
    passkey,
    callback_url,
    environment,
    is_active
  ) VALUES (
    auth.uid(),
    p_consumer_key,
    p_consumer_secret,
    p_business_shortcode,
    p_passkey,
    p_callback_url,
    p_environment,
    p_is_active
  ) RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$;