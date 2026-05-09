-- Add provider column to mpesa_transactions
ALTER TABLE mpesa_transactions 
ADD COLUMN provider text DEFAULT 'mpesa' CHECK (provider IN ('mpesa', 'kopokopo'));

-- Add index for better query performance
CREATE INDEX idx_mpesa_transactions_provider ON mpesa_transactions(provider);

-- Backfill existing records based on metadata
UPDATE mpesa_transactions 
SET provider = COALESCE(
  metadata->>'provider',
  CASE 
    WHEN checkout_request_id LIKE 'kk_%' THEN 'kopokopo'
    ELSE 'mpesa'
  END
)
WHERE provider IS NULL OR provider = 'mpesa';

-- Add comment for documentation
COMMENT ON COLUMN mpesa_transactions.provider IS 'Payment provider: mpesa (Safaricom direct) or kopokopo (Kopo Kopo gateway)';