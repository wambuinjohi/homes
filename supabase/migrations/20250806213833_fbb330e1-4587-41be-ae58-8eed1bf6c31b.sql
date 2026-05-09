-- Create cron job to run trial manager daily
-- First enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the trial manager to run daily at 8:00 AM
SELECT cron.schedule(
  'daily-trial-manager',
  '0 8 * * *', -- Daily at 8:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://kdpqimetajnhcqseajok.supabase.co/functions/v1/trial-manager',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);