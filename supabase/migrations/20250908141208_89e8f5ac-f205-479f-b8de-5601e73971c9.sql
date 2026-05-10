-- COMPREHENSIVE SECURITY FIX: Part 3 - Fix Warnings & Complete Encryption Setup

-- Step C: Fix Warning 1 - Function Search Path Mutable
-- Update all functions to have explicit search_path set to prevent SQL injection
-- First, let's identify and fix functions with mutable search paths

-- Fix the existing encryption functions to have proper search_path (already done in previous migration)

-- Fix other functions that may not have proper search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Update other critical functions to have proper search_path
CREATE OR REPLACE FUNCTION public.get_invoice_overview(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS TABLE(
  id uuid, lease_id uuid, tenant_id uuid, invoice_date date, due_date date, 
  amount numeric, created_at timestamptz, updated_at timestamptz, property_id uuid,
  property_owner_id uuid, property_manager_id uuid, amount_paid_allocated numeric,
  amount_paid_direct numeric, amount_paid_total numeric, outstanding_amount numeric,
  computed_status text, invoice_number text, property_name text, status text,
  description text, first_name text, last_name text, email text, phone text, unit_number text
)
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean := false;
  v_user_id uuid := auth.uid();
BEGIN
  -- Check if user is admin
  SELECT public.has_role(v_user_id, 'Admin'::public.app_role) INTO v_is_admin;
  
  RETURN QUERY
  SELECT 
    i.id, i.lease_id, i.tenant_id, i.invoice_date, i.due_date,
    i.amount, i.created_at, i.updated_at, u.property_id,
    p.owner_id as property_owner_id, p.manager_id as property_manager_id,
    COALESCE(pa.total_allocated, 0) as amount_paid_allocated,
    COALESCE(py.total_direct, 0) as amount_paid_direct,
    COALESCE(pa.total_allocated, 0) + COALESCE(py.total_direct, 0) as amount_paid_total,
    i.amount - (COALESCE(pa.total_allocated, 0) + COALESCE(py.total_direct, 0)) as outstanding_amount,
    CASE 
      WHEN i.amount <= (COALESCE(pa.total_allocated, 0) + COALESCE(py.total_direct, 0)) THEN 'paid'
      WHEN i.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END as computed_status,
    i.invoice_number, p.name as property_name, i.status, i.description,
    t.first_name, t.last_name, 
    public.mask_sensitive_data(t.email, 3) as email,
    public.mask_sensitive_data(t.phone, 4) as phone,
    u.unit_number
  FROM public.invoices i
  JOIN public.leases l ON l.id = i.lease_id
  JOIN public.units u ON u.id = l.unit_id
  JOIN public.properties p ON p.id = u.property_id
  JOIN public.tenants t ON t.id = i.tenant_id
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) as total_allocated
    FROM public.payment_allocations
    GROUP BY invoice_id
  ) pa ON pa.invoice_id = i.id
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) as total_direct
    FROM public.payments
    WHERE status = 'completed'
    GROUP BY invoice_id
  ) py ON py.invoice_id = i.id
  WHERE (
    v_is_admin 
    OR p.owner_id = v_user_id 
    OR p.manager_id = v_user_id 
    OR t.user_id = v_user_id
  )
  AND (p_search IS NULL OR (
    i.invoice_number ILIKE '%' || p_search || '%' OR
    t.first_name ILIKE '%' || p_search || '%' OR
    t.last_name ILIKE '%' || p_search || '%' OR
    p.name ILIKE '%' || p_search || '%'
  ))
  AND (p_status IS NULL OR i.status = p_status)
  ORDER BY i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;