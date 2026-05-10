-- Manual fix for the failed payment: ws_CO_11122025141155063723301507
-- Transaction: KES 20 paid, Invoice: KES 12, Overpayment: KES 8

-- Step 1: Create the payment record
INSERT INTO payments (
  tenant_id,
  lease_id,
  invoice_id,
  amount,
  payment_method,
  payment_date,
  transaction_id,
  payment_reference,
  payment_type,
  status,
  notes
) VALUES (
  'f4fafcf8-63f0-4f85-8e98-8988695ef74c', -- tenant_id
  '9e1d8fc4-d7ea-4e13-99da-c38e155cc4f2', -- lease_id
  'c6305be4-4bf8-4cc4-86a2-0bd578516967', -- invoice_id
  20.00, -- actual paid amount
  'M-Pesa',
  CURRENT_DATE,
  'TLBLU0MEG0', -- mpesa_receipt_number
  'ws_CO_11122025141155063723301507', -- checkout_request_id
  'rent',
  'completed',
  'M-Pesa payment via STK Push. Receipt: TLBLU0MEG0. KES 8 credited to account (manual fix for callback processing issue).'
) RETURNING id;

-- Step 2: Create payment allocation (KES 12 to invoice)
-- Will use the payment ID from above in a separate statement

-- Step 3: Create tenant credit for overpayment (KES 8)
INSERT INTO tenant_credits (
  tenant_id,
  landlord_id,
  amount,
  balance,
  description,
  source_type
) VALUES (
  'f4fafcf8-63f0-4f85-8e98-8988695ef74c', -- tenant_id
  '48a2a4ae-ded3-4c3e-966b-c26711a6d3a9', -- landlord_id (owner_id)
  8.00, -- overpayment amount
  8.00, -- balance (same as amount initially)
  'Overpayment from M-Pesa. Receipt: TLBLU0MEG0 (manual fix)',
  'overpayment'
);

-- Step 4: Create payment allocation using a DO block to get the payment ID
DO $$
DECLARE
  v_payment_id UUID;
BEGIN
  SELECT id INTO v_payment_id FROM payments 
  WHERE payment_reference = 'ws_CO_11122025141155063723301507' 
  LIMIT 1;
  
  IF v_payment_id IS NOT NULL THEN
    INSERT INTO payment_allocations (payment_id, invoice_id, amount)
    VALUES (v_payment_id, 'c6305be4-4bf8-4cc4-86a2-0bd578516967', 12.00);
    
    -- Update the tenant_credits with source_payment_id
    UPDATE tenant_credits 
    SET source_payment_id = v_payment_id 
    WHERE tenant_id = 'f4fafcf8-63f0-4f85-8e98-8988695ef74c' 
      AND description LIKE '%TLBLU0MEG0%';
  END IF;
END $$;