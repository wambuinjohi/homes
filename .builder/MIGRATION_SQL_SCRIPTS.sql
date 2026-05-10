-- ============================================================================
-- SUPABASE MIGRATION SQL SCRIPTS
-- Project: kdpqimetajnhcqseajok → tbmzwmgsvshfdxdoyrcr
-- Execute these in Supabase Dashboard → SQL Editor for new project
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Required Extensions (Run First)
-- ============================================================================
-- This enables scheduled jobs and HTTP requests from the database

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verify extensions are enabled
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- ============================================================================
-- STEP 2: Schedule Overdue Invoice Reminders
-- ============================================================================
-- Runs daily at 9:00 AM to send SMS reminders for overdue invoices

SELECT cron.schedule(
  'send-overdue-invoice-reminders',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/send-overdue-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45"}'::jsonb,
        body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Verify cron job was scheduled
SELECT * FROM cron.job WHERE jobname = 'send-overdue-invoice-reminders';

-- ============================================================================
-- STEP 3: Schedule Automated Monthly Billing
-- ============================================================================
-- Runs daily at 1:00 AM to process monthly billing

SELECT cron.schedule(
  'automated-monthly-billing-job',
  '0 1 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/automated-monthly-billing',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45"}'::jsonb,
        body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Verify billing cron job
SELECT * FROM cron.job WHERE jobname = 'automated-monthly-billing-job';

-- ============================================================================
-- STEP 4: Verify Critical Tables Exist
-- ============================================================================
-- Run these queries to confirm all tables were migrated successfully

-- Check main application tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verify specific critical tables
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables 
  WHERE table_schema = 'public';
  RAISE NOTICE 'Total public tables: %', table_count;
END $$;

-- ============================================================================
-- STEP 5: Verify RLS Policies (Row Level Security)
-- ============================================================================
-- Ensure all RLS policies were migrated with the schema

SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Count RLS policies
SELECT COUNT(*) as total_rls_policies FROM pg_policies WHERE schemaname = 'public';

-- ============================================================================
-- STEP 6: Verify Custom Functions
-- ============================================================================
-- Check that database functions exist (e.g., sub-user functions)

SELECT 
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ============================================================================
-- STEP 7: Check Indexes (Database Performance)
-- ============================================================================
-- Verify all indexes were migrated for optimal query performance

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- STEP 8: View All Scheduled Jobs
-- ============================================================================
-- Monitor all cron jobs scheduled in this database

SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobname;

-- ============================================================================
-- STEP 9: Unschedule Jobs (If Needed for Rollback)
-- ============================================================================
-- Use these if you need to remove cron jobs during testing/rollback

-- SELECT cron.unschedule('send-overdue-invoice-reminders');
-- SELECT cron.unschedule('automated-monthly-billing-job');

-- ============================================================================
-- STEP 10: Test Cron Job Trigger (Manual Testing)
-- ============================================================================
-- Manually trigger a function to test without waiting for schedule

-- Test send-overdue-reminders function
-- SELECT
--   net.http_post(
--       url:='https://tbmzwmgsvshfdxdoyrcr.supabase.co/functions/v1/send-overdue-reminders',
--       headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45"}'::jsonb,
--       body:='{"triggered_at": "manual-test"}'::jsonb
--   ) as request_id;

-- ============================================================================
-- STEP 11: Verify Extension Settings (If Needed)
-- ============================================================================
-- Check extension configuration

SELECT * FROM pg_extension_config_dump('pg_cron', 'shared_preload_libraries');

-- ============================================================================
-- POST-MIGRATION VERIFICATION CHECKLIST
-- ============================================================================
-- After running all steps above, verify:
-- 
-- ✅ Extensions enabled (pg_cron, pg_net)
-- ✅ All tables migrated (50+ tables)
-- ✅ RLS policies in place
-- ✅ Custom functions exist
-- ✅ Indexes created for performance
-- ✅ Cron jobs scheduled (2 total)
-- ✅ No error messages in execution
--
-- If any step fails, check Supabase dashboard error messages and:
-- 1. Verify new project has access to pg_cron/pg_net extensions
-- 2. Check database quota is sufficient
-- 3. Review Supabase project plan (extensions require specific plan level)

-- ============================================================================
