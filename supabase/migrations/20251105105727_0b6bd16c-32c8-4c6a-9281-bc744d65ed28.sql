-- Fix RLS policies for tenant and lease creation
-- Drop problematic ALL policies and replace with specific operation policies

-- =====================================================
-- TENANTS TABLE: Fix RLS to allow INSERT
-- =====================================================

DROP POLICY IF EXISTS tenants_access_v2 ON public.tenants;

-- SELECT: Can view own tenant account, or tenants belonging to owned properties, or admin
CREATE POLICY "tenants_select_policy" ON public.tenants
FOR SELECT USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR (user_id = auth.uid()) 
  OR tenant_belongs_to_user(id, auth.uid())
);

-- INSERT: Landlords/Admins/Sub-users with permission can create tenants
CREATE POLICY "tenants_insert_policy" ON public.tenants
FOR INSERT WITH CHECK (
  has_role_safe(auth.uid(), 'Admin'::app_role)
  OR has_role_safe(auth.uid(), 'Landlord'::app_role)
  OR get_sub_user_permissions(auth.uid(), 'manage_tenants')
);

-- UPDATE: Can update own tenant account, or tenants belonging to owned properties, or admin
CREATE POLICY "tenants_update_policy" ON public.tenants
FOR UPDATE USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR (user_id = auth.uid()) 
  OR tenant_belongs_to_user(id, auth.uid())
);

-- DELETE: Only admins or landlords managing the tenant
CREATE POLICY "tenants_delete_policy" ON public.tenants
FOR DELETE USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR tenant_belongs_to_user(id, auth.uid())
);

-- =====================================================
-- LEASES TABLE: Fix RLS to allow INSERT
-- =====================================================

DROP POLICY IF EXISTS leases_access_v3 ON public.leases;

-- SELECT: Can view leases for properties they manage or own lease
CREATE POLICY "leases_select_policy" ON public.leases
FOR SELECT USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR user_can_access_lease(id, auth.uid()) 
  OR is_lease_owned_by_tenant_user(id, auth.uid())
);

-- INSERT: Landlords/Admins/Sub-users with permission can create leases for their properties
CREATE POLICY "leases_insert_policy" ON public.leases
FOR INSERT WITH CHECK (
  has_role_safe(auth.uid(), 'Admin'::app_role)
  OR user_can_access_property(
    (SELECT property_id FROM public.units WHERE id = unit_id),
    auth.uid()
  )
);

-- UPDATE: Can update leases for properties they manage
CREATE POLICY "leases_update_policy" ON public.leases
FOR UPDATE USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR user_can_access_lease(id, auth.uid())
);

-- DELETE: Can delete leases for properties they manage
CREATE POLICY "leases_delete_policy" ON public.leases
FOR DELETE USING (
  has_role_safe(auth.uid(), 'Admin'::app_role) 
  OR user_can_access_lease(id, auth.uid())
);

-- =====================================================
-- CLEANUP: Remove duplicate encryption trigger
-- =====================================================

DROP TRIGGER IF EXISTS encrypt_tenant_pii_trigger ON public.tenants;

-- Keep only the optimized encrypt_tenant_data_trigger

-- =====================================================
-- LOGGING: Add RLS violation tracking (optional)
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_rls_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_logs (type, message, service, details)
  VALUES (
    'rls_violation',
    'RLS policy blocked operation on ' || TG_TABLE_NAME,
    'database',
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'user_id', auth.uid(),
      'timestamp', now()
    )
  );
  RETURN NULL;
END;
$$;