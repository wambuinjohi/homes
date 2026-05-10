-- Create optimized tenant profile data RPC
CREATE OR REPLACE FUNCTION public.get_tenant_profile_data(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH tenant_info AS (
    SELECT 
      t.id, t.first_name, t.last_name, t.email, t.phone,
      t.emergency_contact_name, t.emergency_contact_phone,
      t.employment_status, t.employer_name, t.monthly_income,
      t.profession, t.national_id, t.previous_address
    FROM public.tenants t
    WHERE t.user_id = p_user_id
    LIMIT 1
  ),
  lease_info AS (
    SELECT 
      l.id, l.lease_start_date, l.lease_end_date, l.monthly_rent,
      l.security_deposit, l.status, l.lease_terms,
      u.unit_number, u.floor, u.rent_amount as unit_rent,
      p.name as property_name, p.address, p.city, p.state,
      p.amenities, p.description as property_description
    FROM public.leases l
    JOIN public.tenants t ON l.tenant_id = t.id  
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE t.user_id = p_user_id
      AND COALESCE(l.status, 'active') = 'active'
    ORDER BY l.lease_start_date DESC
    LIMIT 1
  ),
  landlord_info AS (
    SELECT 
      pr.first_name as landlord_first_name,
      pr.last_name as landlord_last_name,
      pr.email as landlord_email,
      pr.phone as landlord_phone
    FROM public.leases l
    JOIN public.tenants t ON l.tenant_id = t.id
    JOIN public.units u ON l.unit_id = u.id  
    JOIN public.properties p ON u.property_id = p.id
    JOIN public.profiles pr ON p.owner_id = pr.id
    WHERE t.user_id = p_user_id
      AND COALESCE(l.status, 'active') = 'active'
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'tenant', COALESCE((SELECT row_to_json(tenant_info) FROM tenant_info), null),
    'lease', COALESCE((SELECT row_to_json(lease_info) FROM lease_info), null),
    'landlord', COALESCE((SELECT row_to_json(landlord_info) FROM landlord_info), null)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Create optimized tenant maintenance data RPC
CREATE OR REPLACE FUNCTION public.get_tenant_maintenance_data(p_user_id uuid DEFAULT auth.uid(), p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH tenant_requests AS (
    SELECT 
      mr.id, mr.title, mr.description, mr.category, mr.priority,
      mr.status, mr.submitted_date, mr.scheduled_date, mr.completed_date,
      mr.cost, mr.notes, mr.images,
      p.name as property_name,
      u.unit_number
    FROM public.maintenance_requests mr
    JOIN public.tenants t ON mr.tenant_id = t.id
    JOIN public.properties p ON mr.property_id = p.id
    LEFT JOIN public.units u ON mr.unit_id = u.id
    WHERE t.user_id = p_user_id
    ORDER BY mr.submitted_date DESC
    LIMIT p_limit
  ),
  request_stats AS (
    SELECT 
      COUNT(*)::int as total_requests,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
      COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
      COUNT(CASE WHEN priority = 'high' THEN 1 END)::int as high_priority
    FROM public.maintenance_requests mr
    JOIN public.tenants t ON mr.tenant_id = t.id
    WHERE t.user_id = p_user_id
  )
  SELECT jsonb_build_object(
    'requests', COALESCE((
      SELECT jsonb_agg(row_to_json(tenant_requests))
      FROM tenant_requests
    ), '[]'::jsonb),
    'stats', COALESCE((SELECT row_to_json(request_stats) FROM request_stats), null)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Create optimized landlord dashboard data RPC
CREATE OR REPLACE FUNCTION public.get_landlord_dashboard_data(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH property_stats AS (
    SELECT 
      COUNT(p.id)::int as total_properties,
      COALESCE(SUM(p.total_units), 0)::int as total_units,
      COUNT(DISTINCT l.id)::int as occupied_units,
      COALESCE(SUM(l.monthly_rent), 0)::numeric as monthly_revenue
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id AND COALESCE(l.status, 'active') = 'active'
    WHERE p.owner_id = p_user_id OR p.manager_id = p_user_id
  ),
  recent_payments AS (
    SELECT 
      py.id, py.amount, py.payment_date, py.payment_method,
      py.status, py.payment_reference,
      t.first_name || ' ' || t.last_name as tenant_name,
      p.name as property_name, u.unit_number
    FROM public.payments py
    JOIN public.leases l ON py.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    JOIN public.tenants t ON py.tenant_id = t.id
    WHERE (p.owner_id = p_user_id OR p.manager_id = p_user_id)
      AND py.status = 'completed'
    ORDER BY py.payment_date DESC
    LIMIT 10
  ),
  pending_maintenance AS (
    SELECT 
      mr.id, mr.title, mr.priority, mr.submitted_date,
      mr.category, mr.status,
      p.name as property_name, u.unit_number,
      t.first_name || ' ' || t.last_name as tenant_name
    FROM public.maintenance_requests mr
    JOIN public.properties p ON mr.property_id = p.id
    LEFT JOIN public.units u ON mr.unit_id = u.id
    LEFT JOIN public.tenants t ON mr.tenant_id = t.id
    WHERE (p.owner_id = p_user_id OR p.manager_id = p_user_id)
      AND mr.status IN ('pending', 'in_progress')
    ORDER BY 
      CASE mr.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      mr.submitted_date DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'property_stats', COALESCE((SELECT row_to_json(property_stats) FROM property_stats), null),
    'recent_payments', COALESCE((
      SELECT jsonb_agg(row_to_json(recent_payments))
      FROM recent_payments
    ), '[]'::jsonb),
    'pending_maintenance', COALESCE((
      SELECT jsonb_agg(row_to_json(pending_maintenance)) 
      FROM pending_maintenance
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Add database indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON public.tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id_status ON public.leases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_unit_id_status ON public.leases(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant_status ON public.maintenance_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_property_status ON public.maintenance_requests(property_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON public.payments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_lease_status ON public.payments(lease_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON public.invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_owner_manager ON public.properties(owner_id, manager_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payments_date_status ON public.payments(payment_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_date_priority ON public.maintenance_requests(submitted_date DESC, priority);
CREATE INDEX IF NOT EXISTS idx_invoices_date_status ON public.invoices(invoice_date DESC, status);