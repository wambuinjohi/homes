-- Fix the successful M-Pesa payment that wasn't processed correctly
-- Insert the missing payment record for the successful M-Pesa transaction
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
  'fc5ff96f-d6fa-4076-8d54-772f05d1e929',
  '8c5e4212-6c4c-4dac-a327-a9d9e66af54a',
  '6e22ca0b-cb19-4f16-9780-e24612a155c5',
  5.00,
  'M-Pesa',
  '2025-08-04',
  'TH49V60CWN',
  'ws_CO_1754310757662723301507',
  'rent',
  'completed',
  'M-Pesa payment via STK Push. Receipt: TH49V60CWN'
);

-- Update the invoice status to paid
UPDATE invoices 
SET status = 'paid', updated_at = now() 
WHERE id = '6e22ca0b-cb19-4f16-9780-e24612a155c5';