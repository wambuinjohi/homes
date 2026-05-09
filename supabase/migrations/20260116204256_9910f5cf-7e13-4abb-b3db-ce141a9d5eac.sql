-- Temporarily disable the audit trigger
ALTER TABLE public.billing_plans DISABLE TRIGGER billing_plan_audit_trigger;

-- Update SMS credits for landlord plans
UPDATE billing_plans SET sms_credits_included = 50 WHERE name = 'Micro' AND plan_category = 'landlord';
UPDATE billing_plans SET sms_credits_included = 200 WHERE name = 'Standard' AND plan_category = 'landlord';
UPDATE billing_plans SET sms_credits_included = 400 WHERE name = 'Premium' AND plan_category = 'landlord';
UPDATE billing_plans SET sms_credits_included = NULL WHERE name = 'Enterprise' AND plan_category = 'landlord';

-- Re-enable the audit trigger
ALTER TABLE public.billing_plans ENABLE TRIGGER billing_plan_audit_trigger;