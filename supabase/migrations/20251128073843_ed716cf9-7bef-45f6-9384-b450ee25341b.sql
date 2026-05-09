-- Create table for Jenga PAY IPN callbacks
CREATE TABLE IF NOT EXISTS public.jenga_ipn_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  callback_type TEXT NOT NULL,
  
  -- Customer information
  customer_name TEXT,
  customer_mobile TEXT,
  customer_reference TEXT,
  
  -- Transaction details
  transaction_date TIMESTAMP WITH TIME ZONE,
  transaction_reference TEXT NOT NULL UNIQUE,
  payment_mode TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  bill_number TEXT,
  served_by TEXT,
  additional_info TEXT,
  order_amount NUMERIC(10, 2),
  service_charge NUMERIC(10, 2),
  status TEXT NOT NULL,
  remarks TEXT,
  
  -- Bank details
  bank_reference TEXT,
  transaction_type TEXT,
  bank_account TEXT,
  
  -- System fields
  landlord_id UUID REFERENCES auth.users(id),
  invoice_id UUID REFERENCES invoices(id),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB NOT NULL,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jenga_ipn_callbacks ENABLE ROW LEVEL SECURITY;

-- Admin policy - view all callbacks
CREATE POLICY "Admins can view all Jenga callbacks"
  ON public.jenga_ipn_callbacks
  FOR SELECT
  USING (public.has_role(auth.uid(), 'Admin'::public.app_role));

-- Landlords can view their own callbacks
CREATE POLICY "Landlords can view their own Jenga callbacks"
  ON public.jenga_ipn_callbacks
  FOR SELECT
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'Landlord'::public.app_role));

-- Service role can insert callbacks (for edge function)
CREATE POLICY "Service role can insert callbacks"
  ON public.jenga_ipn_callbacks
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_jenga_ipn_transaction_ref ON public.jenga_ipn_callbacks(transaction_reference);
CREATE INDEX idx_jenga_ipn_landlord ON public.jenga_ipn_callbacks(landlord_id);
CREATE INDEX idx_jenga_ipn_invoice ON public.jenga_ipn_callbacks(invoice_id);
CREATE INDEX idx_jenga_ipn_status ON public.jenga_ipn_callbacks(status, processed);
CREATE INDEX idx_jenga_ipn_created ON public.jenga_ipn_callbacks(created_at DESC);

-- Create table for landlord Jenga PAY configurations
CREATE TABLE IF NOT EXISTS public.landlord_jenga_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Jenga credentials (encrypted)
  merchant_code TEXT NOT NULL,
  api_key_encrypted TEXT,
  consumer_secret_encrypted TEXT,
  
  -- Configuration
  paybill_number TEXT NOT NULL DEFAULT '247247',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_active BOOLEAN DEFAULT true,
  
  -- Webhook settings
  ipn_url TEXT,
  ipn_username TEXT,
  ipn_password_encrypted TEXT,
  
  -- Verification
  credentials_verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(landlord_id)
);

-- Enable RLS
ALTER TABLE public.landlord_jenga_configs ENABLE ROW LEVEL SECURITY;

-- Landlords can manage their own config
CREATE POLICY "Landlords can manage their own Jenga config"
  ON public.landlord_jenga_configs
  FOR ALL
  USING (landlord_id = auth.uid());

-- Admins can view all configs
CREATE POLICY "Admins can view all Jenga configs"
  ON public.landlord_jenga_configs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'Admin'::public.app_role));

-- Create index
CREATE INDEX idx_landlord_jenga_landlord ON public.landlord_jenga_configs(landlord_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_jenga_ipn_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jenga_ipn_callbacks_updated_at
  BEFORE UPDATE ON public.jenga_ipn_callbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_jenga_ipn_updated_at();

CREATE TRIGGER update_landlord_jenga_configs_updated_at
  BEFORE UPDATE ON public.landlord_jenga_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_jenga_ipn_updated_at();