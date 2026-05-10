
-- Give property owners/managers full control over their leases
-- Existing policies:
-- - Admins can manage all leases (ALL)
-- - Tenants can view own leases (SELECT)
-- This adds owner/manager policies via units -> properties ownership.

-- Allow owners/managers to SELECT leases
CREATE POLICY "Owners/managers can view leases"
ON public.leases
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
);

-- Allow owners/managers to INSERT leases
CREATE POLICY "Owners/managers can insert leases"
ON public.leases
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
);

-- Allow owners/managers to UPDATE leases
CREATE POLICY "Owners/managers can update leases"
ON public.leases
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
);

-- Allow owners/managers to DELETE leases
CREATE POLICY "Owners/managers can delete leases"
ON public.leases
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
);
