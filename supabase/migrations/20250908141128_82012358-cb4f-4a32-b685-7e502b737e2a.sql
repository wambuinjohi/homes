-- COMPREHENSIVE SECURITY FIX: Part 2 - Encrypt Existing Data & Fix RLS Policies
-- Encrypt sensitive fields and implement proper access control

-- 1. First, let's clean up duplicate and overly permissive policies on profiles table
DROP POLICY IF EXISTS "Admins and Landlords can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create properly restrictive policies for profiles
CREATE POLICY "profiles_select_own_or_related" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated
  USING (
    -- Users can see their own profile
    auth.uid() = id 
    OR 
    -- Property owners can see their tenants' profiles
    (has_role(auth.uid(), 'Landlord'::app_role) AND EXISTS (
      SELECT 1 FROM public.tenants t 
      JOIN public.leases l ON l.tenant_id = t.id 
      JOIN public.units u ON u.id = l.unit_id 
      JOIN public.properties p ON p.id = u.property_id 
      WHERE t.user_id = profiles.id 
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    ))
    OR 
    -- Admins can see all profiles
    has_role(auth.uid(), 'Admin'::app_role)
  );

CREATE POLICY "profiles_insert_own" 
  ON public.profiles 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" 
  ON public.profiles 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Fix payment_transactions policies - remove 'public' role usage
DROP POLICY IF EXISTS "Admins can manage all payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Landlords can view their own payment transactions" ON public.payment_transactions;

CREATE POLICY "payment_transactions_admin_access" 
  ON public.payment_transactions 
  FOR ALL 
  TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "payment_transactions_landlord_access" 
  ON public.payment_transactions 
  FOR SELECT 
  TO authenticated
  USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- 3. Add encrypted columns for sensitive data in mpesa_credentials
ALTER TABLE public.mpesa_credentials 
ADD COLUMN IF NOT EXISTS consumer_key_encrypted text,
ADD COLUMN IF NOT EXISTS consumer_secret_encrypted text,
ADD COLUMN IF NOT EXISTS passkey_encrypted text;

-- 4. Add encrypted columns for sensitive data in tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS phone_encrypted text,
ADD COLUMN IF NOT EXISTS email_encrypted text,
ADD COLUMN IF NOT EXISTS national_id_encrypted text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone_encrypted text;

-- Add search tokens for encrypted fields
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS phone_token text,
ADD COLUMN IF NOT EXISTS email_token text;

-- 5. Add encrypted columns for sms_usage
ALTER TABLE public.sms_usage 
ADD COLUMN IF NOT EXISTS recipient_phone_encrypted text,
ADD COLUMN IF NOT EXISTS message_content_encrypted text;

-- Add search token for phone lookups
ALTER TABLE public.sms_usage 
ADD COLUMN IF NOT EXISTS recipient_phone_token text;