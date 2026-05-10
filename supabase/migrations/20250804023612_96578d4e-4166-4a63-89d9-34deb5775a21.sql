-- Add some sample service providers for demonstration
INSERT INTO public.service_providers (name, email, phone, specialties, is_active) VALUES
('ABC Plumbing Services', 'contact@abcplumbing.com', '+254700123456', ARRAY['plumbing', 'water_heater', 'pipe_repair'], true),
('Elite HVAC Solutions', 'info@elitehvac.com', '+254700234567', ARRAY['hvac', 'air_conditioning', 'heating'], true),
('PowerFix Electrical', 'service@powerfix.com', '+254700345678', ARRAY['electrical', 'wiring', 'lighting'], true),
('HandyMan Pro', 'contact@handymanpro.com', '+254700456789', ARRAY['general_maintenance', 'carpentry', 'painting'], true),
('QuickFix Appliances', 'repairs@quickfix.com', '+254700567890', ARRAY['appliance_repair', 'refrigeration', 'washing_machine'], true);

-- Add some sample maintenance requests with current timestamps
INSERT INTO public.maintenance_requests (
  title, description, priority, status, category, property_id, tenant_id, submitted_date, last_status_change
) VALUES 
(
  'Kitchen Faucet Leaking', 
  'The kitchen faucet has been dripping continuously for the past 3 days. Water is pooling under the sink and may cause damage if not fixed soon.',
  'medium',
  'pending', 
  'plumbing',
  (SELECT id FROM public.properties LIMIT 1),
  (SELECT id FROM public.tenants LIMIT 1),
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),
(
  'Air Conditioning Not Working', 
  'The AC unit in the master bedroom stopped working yesterday. The room is getting very hot and uncomfortable.',
  'high',
  'pending',
  'hvac',
  (SELECT id FROM public.properties LIMIT 1),
  (SELECT id FROM public.tenants LIMIT 1 OFFSET 0),
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),
(
  'Electrical Outlet Not Working',
  'The outlet in the living room near the TV stopped working. Cannot plug in any devices.',
  'low',
  'in_progress',
  'electrical',
  (SELECT id FROM public.properties LIMIT 1),
  (SELECT id FROM public.tenants LIMIT 1),
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '1 day'
);