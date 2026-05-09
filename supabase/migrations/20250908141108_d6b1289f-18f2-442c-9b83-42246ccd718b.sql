-- SECURITY FIX Part 2: Database Hardening & Access Control
-- Fix RLS policies and remove overly broad access

-- 1. Fix payment_transactions policies - remove 'public' role access
DROP POLICY IF EXISTS "Admins can manage all payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Landlords can view their own payment transactions" ON public.payment_transactions;

CREATE POLICY "Admins can manage payment transactions"
  ON public.payment_transactions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (landlord_id = auth.uid());

-- 2. Fix profiles policies - remove overly broad access
DROP POLICY IF EXISTS "Admins and Landlords can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and Landlords can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- More restrictive profile policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Property stakeholders can view tenant profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role) OR
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.tenants t
      JOIN public.leases l ON l.tenant_id = t.id
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE t.user_id = profiles.id
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );