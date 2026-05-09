-- Delete the 7 duplicate payments from today (keep original from November 2025)
DELETE FROM payments 
WHERE id IN (
  'eeab68eb-919c-40c3-b287-ebb68559cd5d',
  '0facbf8d-e088-4ff1-a8bc-04e79e9a2ccc',
  '682f5704-8b0e-4221-bd19-7c82ed3ef0e0',
  '996b6c0a-2967-4f97-8ce3-edb33d9282d4',
  '0516dd30-1945-4d04-b820-0562d8e605bc',
  'c3075808-a3d0-4c4c-b44a-dd650e1fb052',
  '1fe1c27d-e372-44da-9dd6-670a73eab2d4'
);

-- Also add the original payment references to the idempotency table to prevent future re-processing
INSERT INTO kopokopo_processed_callbacks (kopo_reference, amount, phone_number, processed_at) VALUES
  ('TKCLU9YFBU', 10.00, '+254723301507', '2025-11-12T19:49:18Z'),
  ('TKCLU9XOQ4', 10.00, '+254723301507', now()),
  ('TKCLU9XWTN', 10.00, '+254723301507', now()),
  ('TKCLU9YAK3', 10.00, '+254723301507', now()),
  ('TKCLU9YJTB', 10.00, '+254723301507', now()),
  ('TKCLU9YCCD', 10.00, '+254723301507', now()),
  ('TKCLU9YDOO', 10.00, '+254723301507', now()),
  ('TKCLU9YBCD', 10.00, '+254723301507', now())
ON CONFLICT (kopo_reference) DO NOTHING;