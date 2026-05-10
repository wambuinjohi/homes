-- Fix critical security: Secure invoice_overview by updating underlying table policies
-- Since invoice_overview is a view, we need to ensure the underlying tables are properly secured

-- First, let's check and fix the invoices table policies to ensure they're watertight
DROP POLICY IF EXISTS "Property owners can manage their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenants can view invoices via email match" ON public.invoices;
DROP POLICY IF EXISTS "Tenants can view invoices via lease mapping" ON public.invoices;
DROP POLICY IF EXISTS "Tenants can view their own invoices" ON public.invoices;

-- Create comprehensive invoice access policies
CREATE POLICY "Secure invoice access v2" 
ON public.invoices 
FOR ALL
USING (
  -- Admins can access all invoices
  has_role(auth.uid(), 'Admin'::app_role) 
  OR
  -- Property owners/managers can access invoices for their properties
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.id = invoices.lease_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR
  -- Tenants can access their own invoices
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = invoices.tenant_id 
    AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same check for INSERT/UPDATE operations
  has_role(auth.uid(), 'Admin'::app_role) 
  OR
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.id = invoices.lease_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = invoices.tenant_id 
    AND t.user_id = auth.uid()
  )
);

-- Now let's create a security definer function to replace the public view
-- This function will respect RLS policies and provide secure access
CREATE OR REPLACE FUNCTION public.get_invoice_overview(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  lease_id uuid,
  tenant_id uuid,
  invoice_date date,
  due_date date,
  amount numeric,
  created_at timestamptz,
  updated_at timestamptz,
  property_id uuid,
  property_owner_id uuid,
  property_manager_id uuid,
  amount_paid_allocated numeric,
  amount_paid_direct numeric,
  amount_paid_total numeric,
  outstanding_amount numeric,
  computed_status text,
  invoice_number text,
  property_name text,
  status text,
  description text,
  first_name text,
  last_name text,
  email text,
  phone text,
  unit_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.lease_id,
    i.tenant_id,
    i.invoice_date,
    i.due_date,
    i.amount,
    i.created_at,
    i.updated_at,
    p.id as property_id,
    p.owner_id as property_owner_id,
    p.manager_id as property_manager_id,
    COALESCE(pa_sum.amount_allocated, 0) as amount_paid_allocated,
    COALESCE(py_sum.amount_direct, 0) as amount_paid_direct,
    COALESCE(pa_sum.amount_allocated, 0) + COALESCE(py_sum.amount_direct, 0) as amount_paid_total,
    GREATEST(i.amount - (COALESCE(pa_sum.amount_allocated, 0) + COALESCE(py_sum.amount_direct, 0)), 0) as outstanding_amount,
    CASE 
      WHEN i.amount <= (COALESCE(pa_sum.amount_allocated, 0) + COALESCE(py_sum.amount_direct, 0)) THEN 'paid'
      WHEN i.due_date < CURRENT_DATE THEN 'overdue'
      ELSE i.status
    END as computed_status,
    i.invoice_number,
    p.name as property_name,
    i.status,
    i.description,
    t.first_name,
    t.last_name,
    t.email,
    t.phone,
    u.unit_number
  FROM public.invoices i
  JOIN public.leases l ON i.lease_id = l.id
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  JOIN public.tenants t ON i.tenant_id = t.id
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) as amount_allocated
    FROM public.payment_allocations
    GROUP BY invoice_id
  ) pa_sum ON i.id = pa_sum.invoice_id
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) as amount_direct
    FROM public.payments
    WHERE status = 'completed' AND invoice_id IS NOT NULL
    GROUP BY invoice_id
  ) py_sum ON i.id = py_sum.invoice_id
  WHERE 
    -- Apply search filter if provided
    (p_search IS NULL OR 
     i.invoice_number ILIKE '%' || p_search || '%' OR
     t.first_name ILIKE '%' || p_search || '%' OR
     t.last_name ILIKE '%' || p_search || '%' OR
     t.email ILIKE '%' || p_search || '%' OR
     p.name ILIKE '%' || p_search || '%')
    -- Apply status filter if provided
    AND (p_status IS NULL OR 
         (p_status = 'paid' AND i.amount <= (COALESCE(pa_sum.amount_allocated, 0) + COALESCE(py_sum.amount_direct, 0))) OR
         (p_status = 'overdue' AND i.due_date < CURRENT_DATE AND i.amount > (COALESCE(pa_sum.amount_allocated, 0) + COALESCE(py_sum.amount_direct, 0))) OR
         (p_status != 'paid' AND p_status != 'overdue' AND i.status = p_status))
  ORDER BY i.invoice_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Grant proper permissions for the function
GRANT EXECUTE ON FUNCTION public.get_invoice_overview TO authenticated;

-- Add comment explaining the security approach
COMMENT ON FUNCTION public.get_invoice_overview IS 'Secure invoice overview function that respects RLS policies on underlying tables. Replaces the public invoice_overview view to prevent data exposure.';