-- Phase 6: Critical Data Security - Address all sensitive table exposures

-- 1. Secure tenants table (Customer Personal Information)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
-- Revoke any public access
REVOKE ALL ON public.tenants FROM PUBLIC;
REVOKE ALL ON public.tenants FROM anon;

-- 2. Secure mpesa_credentials table (Payment System Credentials)
ALTER TABLE public.mpesa_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mpesa_credentials FROM PUBLIC;
REVOKE ALL ON public.mpesa_credentials FROM anon;

-- 3. Secure landlord_mpesa_configs table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'landlord_mpesa_configs') THEN
    ALTER TABLE public.landlord_mpesa_configs ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.landlord_mpesa_configs FROM PUBLIC;
    REVOKE ALL ON public.landlord_mpesa_configs FROM anon;
  END IF;
END $$;

-- 4. Secure sms_usage table (Communication Data)
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_usage FROM PUBLIC;
REVOKE ALL ON public.sms_usage FROM anon;

-- 5. Secure email_logs table if it exists (Communication Data)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_logs') THEN
    ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.email_logs FROM PUBLIC;
    REVOKE ALL ON public.email_logs FROM anon;
  END IF;
END $$;

-- 6. Secure mpesa_transactions table (Financial Records)
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mpesa_transactions FROM PUBLIC;
REVOKE ALL ON public.mpesa_transactions FROM anon;

-- 7. Secure payments table (Financial Records)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payments FROM PUBLIC;
REVOKE ALL ON public.payments FROM anon;

-- 8. Secure invoices table (Financial Records)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoices FROM PUBLIC;
REVOKE ALL ON public.invoices FROM anon;

-- 9. Secure landlord_payment_preferences table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'landlord_payment_preferences') THEN
    ALTER TABLE public.landlord_payment_preferences ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.landlord_payment_preferences FROM PUBLIC;
    REVOKE ALL ON public.landlord_payment_preferences FROM anon;
  END IF;
END $$;

-- 10. Secure profiles table (User Profile Information)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC;
REVOKE ALL ON public.profiles FROM anon;

-- 11. Global security cleanup - revoke CREATE permissions from sensitive schemas
-- Ensure no user can create objects in critical schemas
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

-- Grant minimal required permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 12. Revoke any sequence permissions that might bypass RLS
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 13. Revoke any function permissions that might be too broad
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
-- Grant execute to authenticated users (they still need RLS checks inside functions)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;