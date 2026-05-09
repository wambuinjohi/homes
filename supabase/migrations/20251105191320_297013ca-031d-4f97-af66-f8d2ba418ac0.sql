-- Create SMS Credit Transactions table for full audit trail
CREATE TABLE IF NOT EXISTS sms_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'initial_grant',      -- From plan signup
    'plan_upgrade',       -- From plan change
    'purchase',           -- M-Pesa top-up
    'usage',              -- SMS sent
    'refund',             -- Failed SMS refund
    'admin_adjustment'    -- Manual admin change
  )),
  credits_change INTEGER NOT NULL,  -- Positive for additions, negative for usage
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id UUID,  -- Links to sms_logs, mpesa_transactions, etc.
  reference_type TEXT,  -- Type of reference (sms_log, mpesa_transaction, etc.)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_sms_credit_trans_landlord ON sms_credit_transactions(landlord_id, created_at DESC);
CREATE INDEX idx_sms_credit_trans_type ON sms_credit_transactions(transaction_type);
CREATE INDEX idx_sms_credit_trans_ref ON sms_credit_transactions(reference_id);
CREATE INDEX idx_sms_credit_trans_date ON sms_credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE sms_credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Landlords can view their own transaction history
CREATE POLICY "Landlords view own SMS credit transactions"
  ON sms_credit_transactions
  FOR SELECT
  USING (
    landlord_id = auth.uid() 
    OR has_role(auth.uid(), 'Admin'::app_role)
  );

-- Admins can view all transactions
CREATE POLICY "Admins manage all SMS credit transactions"
  ON sms_credit_transactions
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- System can insert transaction logs (service role)
CREATE POLICY "System can insert SMS credit transactions"
  ON sms_credit_transactions
  FOR INSERT
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE sms_credit_transactions IS 'Audit trail for all SMS credit changes including purchases, usage, refunds, and admin adjustments';
COMMENT ON COLUMN sms_credit_transactions.credits_change IS 'Positive values for additions (purchase, refund), negative for usage';
COMMENT ON COLUMN sms_credit_transactions.reference_id IS 'UUID linking to related record (sms_logs.id, mpesa_transactions.id, etc.)';
COMMENT ON COLUMN sms_credit_transactions.reference_type IS 'Type of linked record for easier querying (sms_log, mpesa_transaction, subscription, manual)';
