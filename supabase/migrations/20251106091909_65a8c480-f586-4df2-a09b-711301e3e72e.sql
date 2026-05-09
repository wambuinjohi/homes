-- Create mpesa_stk_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS mpesa_stk_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_request_id TEXT NOT NULL,
  checkout_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  account_reference TEXT,
  transaction_desc TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  invoice_id UUID,
  payment_type TEXT,
  landlord_id UUID,
  provider TEXT DEFAULT 'mpesa' CHECK (provider IN ('mpesa', 'kopokopo')),
  response_code TEXT,
  response_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE mpesa_stk_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Landlords can view their own STK requests"
  ON mpesa_stk_requests FOR SELECT
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role));

CREATE POLICY "System can insert STK requests"
  ON mpesa_stk_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update STK requests"
  ON mpesa_stk_requests FOR UPDATE
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_mpesa_stk_requests_checkout_id ON mpesa_stk_requests(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_stk_requests_merchant_id ON mpesa_stk_requests(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_stk_requests_landlord_id ON mpesa_stk_requests(landlord_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_stk_requests_invoice_id ON mpesa_stk_requests(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_stk_requests_provider ON mpesa_stk_requests(provider);
CREATE INDEX IF NOT EXISTS idx_mpesa_stk_requests_status ON mpesa_stk_requests(status);

-- Add trigger for updated_at
CREATE TRIGGER update_mpesa_stk_requests_updated_at
  BEFORE UPDATE ON mpesa_stk_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_stk_requests_updated_at();

-- Add comments for documentation
COMMENT ON TABLE mpesa_stk_requests IS 'Stores M-Pesa and Kopo Kopo STK push payment requests';
COMMENT ON COLUMN mpesa_stk_requests.provider IS 'Payment provider used: mpesa (Safaricom direct) or kopokopo (Kopo Kopo gateway)';
COMMENT ON COLUMN mpesa_stk_requests.payment_type IS 'Type of payment: rent, service-charge, subscription, sms_bundle';