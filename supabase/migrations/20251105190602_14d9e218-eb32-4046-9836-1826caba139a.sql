-- Update SMS bundles from USD to KES currency
-- Conversion rate: 1 USD = 130 KES

UPDATE sms_bundles 
SET 
  currency = 'KES',
  price = CASE 
    WHEN price = 5.00 THEN 650
    WHEN price = 20.00 THEN 2600
    WHEN price = 35.00 THEN 4550
    WHEN price = 150.00 THEN 19500
    ELSE price * 130
  END
WHERE currency = 'USD' OR currency IS NULL;

-- Add comment for audit trail
COMMENT ON TABLE sms_bundles IS 'SMS credit bundles for purchase. Prices are in local currency (KES for Kenya).';