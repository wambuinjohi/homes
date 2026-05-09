-- =====================================================
-- UNIFIED BANK CONFIGURATION SCHEMA
-- Supports all Kenyan banks with flexible configuration
-- =====================================================

-- 1. Bank Providers Reference Table
CREATE TABLE public.bank_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code TEXT UNIQUE NOT NULL,
  bank_name TEXT NOT NULL,
  api_gateway_name TEXT,
  paybill_number TEXT,
  country_code TEXT DEFAULT 'KE',
  logo_url TEXT,
  api_base_url_sandbox TEXT,
  api_base_url_production TEXT,
  documentation_url TEXT,
  required_credentials JSONB DEFAULT '[]'::jsonb,
  supported_features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Unified Landlord Bank Configurations Table
CREATE TABLE public.landlord_bank_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL,
  
  -- Common fields
  merchant_code TEXT,
  account_number TEXT,
  paybill_number TEXT,
  environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_active BOOLEAN DEFAULT true,
  
  -- Authentication credentials (encrypted)
  api_key_encrypted TEXT,
  consumer_secret_encrypted TEXT,
  access_token_encrypted TEXT,
  
  -- IPN/Webhook configuration
  ipn_url TEXT,
  ipn_username TEXT,
  ipn_password_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  
  -- Bank-specific extended configuration
  extended_config JSONB DEFAULT '{}'::jsonb,
  
  -- Verification status
  credentials_verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  verification_method TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_landlord_bank UNIQUE (landlord_id, bank_code)
);

-- 3. Unified Bank Callbacks Table
CREATE TABLE public.bank_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Bank identification
  bank_code TEXT NOT NULL,
  callback_type TEXT NOT NULL,
  
  -- Transaction core data
  transaction_reference TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'KES',
  status TEXT NOT NULL,
  transaction_date TIMESTAMPTZ,
  
  -- Customer details
  customer_name TEXT,
  customer_mobile TEXT,
  customer_reference TEXT,
  
  -- Linking to RentFlow entities
  landlord_id UUID REFERENCES auth.users(id),
  invoice_id UUID REFERENCES invoices(id),
  payment_id UUID REFERENCES payments(id),
  
  -- Bank-specific transaction data
  bank_reference TEXT,
  payment_mode TEXT,
  service_charge NUMERIC,
  order_amount NUMERIC,
  order_currency TEXT DEFAULT 'KES',
  
  -- Raw data preservation
  raw_payload JSONB NOT NULL,
  headers JSONB,
  ip_address INET,
  
  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_notes TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE public.bank_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_bank_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_callbacks ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Bank Providers
-- =====================================================
CREATE POLICY "Anyone can view active bank providers"
  ON public.bank_providers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage all bank providers"
  ON public.bank_providers FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- =====================================================
-- RLS POLICIES - Landlord Bank Configs
-- =====================================================
CREATE POLICY "Landlords can manage their own bank configs"
  ON public.landlord_bank_configs FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can view all bank configs"
  ON public.landlord_bank_configs FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Tenants can check landlord bank availability"
  ON public.landlord_bank_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN units u ON l.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      JOIN tenants t ON l.tenant_id = t.id
      WHERE t.user_id = auth.uid()
        AND p.owner_id = landlord_bank_configs.landlord_id
        AND l.status = 'active'
    )
  );

-- =====================================================
-- RLS POLICIES - Bank Callbacks
-- =====================================================
CREATE POLICY "Landlords can view their own callbacks"
  ON public.bank_callbacks FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Admins can view all callbacks"
  ON public.bank_callbacks FOR SELECT
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert callbacks"
  ON public.bank_callbacks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update callbacks"
  ON public.bank_callbacks FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_bank_providers_active ON public.bank_providers(is_active) WHERE is_active = true;
CREATE INDEX idx_bank_providers_code ON public.bank_providers(bank_code);

CREATE INDEX idx_bank_configs_landlord ON public.landlord_bank_configs(landlord_id);
CREATE INDEX idx_bank_configs_bank ON public.landlord_bank_configs(bank_code);
CREATE INDEX idx_bank_configs_active ON public.landlord_bank_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_bank_configs_landlord_active ON public.landlord_bank_configs(landlord_id, is_active) WHERE is_active = true;

CREATE INDEX idx_bank_callbacks_landlord ON public.bank_callbacks(landlord_id);
CREATE INDEX idx_bank_callbacks_invoice ON public.bank_callbacks(invoice_id);
CREATE INDEX idx_bank_callbacks_bank ON public.bank_callbacks(bank_code);
CREATE INDEX idx_bank_callbacks_reference ON public.bank_callbacks(transaction_reference);
CREATE INDEX idx_bank_callbacks_unprocessed ON public.bank_callbacks(processed) WHERE processed = false;
CREATE INDEX idx_bank_callbacks_created ON public.bank_callbacks(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_bank_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bank_providers_updated_at
  BEFORE UPDATE ON public.bank_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_bank_updated_at();

CREATE TRIGGER update_landlord_bank_configs_updated_at
  BEFORE UPDATE ON public.landlord_bank_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_bank_updated_at();

CREATE TRIGGER update_bank_callbacks_updated_at
  BEFORE UPDATE ON public.bank_callbacks
  FOR EACH ROW EXECUTE FUNCTION public.update_bank_updated_at();

-- =====================================================
-- SEED DATA - All 6 Kenyan Banks
-- =====================================================
INSERT INTO public.bank_providers (bank_code, bank_name, api_gateway_name, paybill_number, display_order, required_credentials, supported_features, documentation_url, is_active) VALUES
('equity', 'Equity Bank', 'Jenga PAY', '247247', 1,
 '["merchant_code", "api_key", "consumer_secret", "ipn_username", "ipn_password"]'::jsonb,
 '["ipn_callbacks", "instant_notifications", "bank_transfer", "c2b"]'::jsonb,
 'https://developer.jengahq.io/guides/jenga-pgw/instant-payment-notifications',
 true),

('kcb', 'KCB Bank', 'Buni', '522522', 2,
 '["api_key", "consumer_secret", "merchant_id", "till_number"]'::jsonb,
 '["stk_push", "c2b", "b2c", "account_balance"]'::jsonb,
 'https://developer.kcbbuni.co.ke/',
 false),

('cooperative', 'Co-operative Bank', 'Co-op Connect', '400200', 3,
 '["api_key", "consumer_secret", "account_number", "merchant_id"]'::jsonb,
 '["mpesa_integration", "rtgs", "eft", "pesalink"]'::jsonb,
 'https://developer.co-opbank.co.ke/',
 false),

('im', 'I&M Bank', 'I&M API Gateway', '542542', 4,
 '["api_key", "consumer_secret", "merchant_code", "account_number"]'::jsonb,
 '["mobile_banking", "rtgs", "swift", "pesalink"]'::jsonb,
 'https://www.imbank.com/corporate/api-banking/',
 false),

('ncba', 'NCBA Bank', 'NCBA Loop', '880100', 5,
 '["api_key", "consumer_secret", "organization_code", "account_number"]'::jsonb,
 '["mpesa_integration", "mobile_banking", "pesalink", "rtgs"]'::jsonb,
 'https://loop.ncbagroup.com/',
 false),

('dtb', 'Diamond Trust Bank', 'DTB Connect', '516600', 6,
 '["api_key", "consumer_secret", "customer_id", "account_number"]'::jsonb,
 '["corporate_banking", "rtgs", "eft", "pesalink"]'::jsonb,
 'https://dtbconnect.dtbafrica.com/',
 false);

-- =====================================================
-- MIGRATE EXISTING JENGA CONFIGS
-- =====================================================
INSERT INTO public.landlord_bank_configs (
  landlord_id, bank_code, merchant_code, paybill_number, environment,
  api_key_encrypted, consumer_secret_encrypted, ipn_url, ipn_username,
  ipn_password_encrypted, credentials_verified, last_verified_at, is_active,
  extended_config
)
SELECT 
  landlord_id, 
  'equity', 
  merchant_code, 
  paybill_number, 
  environment,
  api_key_encrypted, 
  consumer_secret_encrypted, 
  ipn_url, 
  ipn_username,
  ipn_password_encrypted, 
  credentials_verified, 
  last_verified_at, 
  is_active,
  jsonb_build_object('migrated_from', 'landlord_jenga_configs', 'migrated_at', now())
FROM public.landlord_jenga_configs
ON CONFLICT (landlord_id, bank_code) DO NOTHING;

-- =====================================================
-- MIGRATE EXISTING JENGA CALLBACKS (optional, for history)
-- =====================================================
INSERT INTO public.bank_callbacks (
  bank_code, callback_type, transaction_reference, amount, currency, status,
  transaction_date, customer_name, customer_mobile, customer_reference,
  landlord_id, invoice_id, bank_reference, payment_mode, service_charge,
  order_amount, order_currency, raw_payload, ip_address, processed, processed_at,
  created_at
)
SELECT 
  'equity',
  callback_type,
  transaction_reference,
  amount,
  COALESCE(currency, 'KES'),
  status,
  transaction_date,
  customer_name,
  customer_mobile,
  bill_number,
  landlord_id,
  invoice_id,
  bank_reference,
  payment_mode,
  service_charge,
  order_amount,
  COALESCE(order_currency, 'KES'),
  raw_data,
  ip_address,
  processed,
  processed_at,
  created_at
FROM public.jenga_ipn_callbacks
ON CONFLICT DO NOTHING;