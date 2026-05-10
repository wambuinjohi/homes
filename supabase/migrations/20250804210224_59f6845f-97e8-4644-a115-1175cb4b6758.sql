-- Add some sample SMS usage data for testing
INSERT INTO public.sms_usage (
  landlord_id,
  recipient_phone,
  message_content,
  cost,
  status,
  sent_at
) VALUES 
  -- Use first landlord in system for demo
  ((SELECT user_id FROM public.user_roles WHERE role = 'Landlord' LIMIT 1), '+254712345678', 'Maintenance request update: Your request #MR-001 has been assigned to John Doe.', 2.50, 'sent', now() - interval '2 days'),
  ((SELECT user_id FROM public.user_roles WHERE role = 'Landlord' LIMIT 1), '+254712345679', 'Rent reminder: Your rent payment is due in 3 days.', 2.50, 'sent', now() - interval '1 day'),
  ((SELECT user_id FROM public.user_roles WHERE role = 'Landlord' LIMIT 1), '+254712345680', 'Welcome to Sunset Apartments! Your lease starts tomorrow.', 2.50, 'sent', now() - interval '5 hours');