-- Create SMS providers configuration table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sms_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  base_url TEXT,
  username TEXT,
  unique_identifier TEXT,
  sender_id TEXT,
  sender_type TEXT,
  authorization_token TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  config_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

-- Create policies for SMS providers
CREATE POLICY "Admins can manage SMS providers" 
ON public.sms_providers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'Admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sms_providers_updated_at
BEFORE UPDATE ON public.sms_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default SMS provider configuration
INSERT INTO public.sms_providers (
  provider_name,
  base_url,
  username,
  unique_identifier,
  sender_id,
  sender_type,
  authorization_token,
  is_active,
  is_default,
  config_data
) VALUES (
  'InHouse SMS',
  'http://68.183.101.252:803/bulk_api/',
  'ZIRA TECH',
  '77',
  'ZIRA TECH',
  '10',
  'your-authorization-token-here',
  true,
  true,
  '{
    "description": "Default InHouse SMS provider configuration",
    "setup_instructions": "Update the authorization_token with your actual SMS provider token"
  }'::jsonb
) ON CONFLICT DO NOTHING;