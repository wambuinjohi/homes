-- Set up automated monthly billing cron job
-- Schedule monthly billing to run on the 1st of each month at 9:00 AM
SELECT cron.schedule(
  'monthly-billing-automation',
  '0 9 1 * *', -- Monthly on the 1st at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/automated-monthly-billing',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "monthly_cron", "period": "automatic"}'::jsonb
    ) as request_id;
  $$
);

-- Ensure automated billing is enabled by default
INSERT INTO automated_billing_settings (
  enabled, 
  billing_day_of_month, 
  grace_period_days, 
  auto_payment_enabled,
  notification_enabled
) VALUES (
  true, 
  1, 
  7, 
  false,
  true
) ON CONFLICT (id) DO UPDATE SET
  enabled = true,
  updated_at = now();