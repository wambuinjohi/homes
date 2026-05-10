-- Swap active M-Pesa configs for landlord hawijeremiah@gmail.com
-- Activate the verified Till (855087) and deactivate the unverified Paybill (4117923)

-- Activate the verified Till config (855087)
UPDATE landlord_mpesa_configs 
SET 
  is_active = true,
  updated_at = now()
WHERE id = '521d7537-6790-40cc-97e4-7783a144c2c1'
  AND landlord_id = '48a2a4ae-ded3-4c3e-966b-c26711a6d3a9';

-- Deactivate the unverified Paybill config (4117923)
UPDATE landlord_mpesa_configs 
SET 
  is_active = false,
  updated_at = now()
WHERE id = '93a5fc74-f160-4359-97ae-7ae8e25ebccf'
  AND landlord_id = '48a2a4ae-ded3-4c3e-966b-c26711a6d3a9';