-- Step 2: Fix critical RLS policy security issues for proper data isolation

-- Properties table has overly permissive policies for landlords
-- Replace the broad "Landlords can manage all properties" policy with proper ownership-based access

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Landlords can manage all properties" ON public.properties;

-- Create secure ownership-based policies for landlords
CREATE POLICY "Property owners can manage their own properties" 
ON public.properties 
FOR ALL 
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() = manager_id);

-- Fix similar issues with units table - ensure landlords only see their units  
DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;

CREATE POLICY "Property stakeholders can manage their units" 
ON public.units 
FOR ALL 
TO authenticated  
USING (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = units.property_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ) 
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix tenants table - remove overly broad role access
DROP POLICY IF EXISTS "Property stakeholders can manage tenants" ON public.tenants;

CREATE POLICY "Property owners can manage their tenants" 
ON public.tenants 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = tenants.id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix leases table security
DROP POLICY IF EXISTS "Property stakeholders can manage leases" ON public.leases;

CREATE POLICY "Property owners can manage their leases" 
ON public.leases 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.properties p ON u.property_id = p.id
    WHERE u.id = leases.unit_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix expenses table  
DROP POLICY IF EXISTS "Property stakeholders can manage expenses" ON public.expenses;

CREATE POLICY "Property owners can manage their expenses" 
ON public.expenses 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = expenses.property_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix maintenance requests
DROP POLICY IF EXISTS "Property stakeholders can manage maintenance requests" ON public.maintenance_requests;

CREATE POLICY "Property owners can manage their maintenance requests" 
ON public.maintenance_requests 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = maintenance_requests.property_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix payments table
DROP POLICY IF EXISTS "Property stakeholders can manage payments" ON public.payments;

CREATE POLICY "Property owners can manage their payments" 
ON public.payments 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.id = payments.lease_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);

-- Fix invoices table 
DROP POLICY IF EXISTS "Property stakeholders can manage invoices" ON public.invoices;

CREATE POLICY "Property owners can manage their invoices" 
ON public.invoices 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.id = invoices.lease_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR has_role(auth.uid(), 'Admin'::app_role)
);