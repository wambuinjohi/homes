-- Phase 1: Add missing communication features to billing plans
-- This ensures trial users (linked to Enterprise) can access email/SMS templates

UPDATE public.billing_plans 
SET features = features || '["communication.email_templates", "communication.sms_templates", "reports.basic", "reports.advanced", "reports.financial"]'::jsonb
WHERE name = 'Enterprise' AND is_active = true;

UPDATE public.billing_plans 
SET features = features || '["communication.email_templates", "communication.sms_templates", "reports.basic", "reports.advanced", "reports.financial"]'::jsonb
WHERE name = 'Professional' AND is_active = true;

-- Add basic reporting to Starter plan too
UPDATE public.billing_plans 
SET features = features || '["reports.basic"]'::jsonb
WHERE name = 'Starter' AND is_active = true;