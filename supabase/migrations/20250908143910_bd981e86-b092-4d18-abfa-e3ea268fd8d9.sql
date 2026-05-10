-- Drop and recreate get_landlord_dashboard_data with proper implementation
DROP FUNCTION IF EXISTS public.get_landlord_dashboard_data(uuid);

CREATE OR REPLACE FUNCTION public.get_landlord_dashboard_data(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_property_stats jsonb;
  v_recent_payments jsonb;
  v_pending_maintenance jsonb;
BEGIN
  -- Property Statistics
  WITH property_stats AS (
    SELECT 
      COUNT(DISTINCT p.id)::int as total_properties,
      COUNT(DISTINCT u.id)::int as total_units,
      COUNT(DISTINCT CASE WHEN u.status = 'occupied' THEN u.id END)::int as occupied_units,
      COALESCE(SUM(CASE WHEN pay.payment_date >= date_trunc('month', now()) 
                        AND pay.status = 'completed' 
                   THEN pay.amount ELSE 0 END), 0)::numeric as monthly_revenue
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id AND COALESCE(l.status, 'active') = 'active'
    LEFT JOIN public.payments pay ON pay.lease_id = l.id
    WHERE (p.owner_id = _user_id OR p.manager_id = _user_id)
       OR COALESCE(public.has_role_safe(_user_id, 'Admin'::public.app_role), public.has_role(_user_id, 'Admin'::public.app_role))
  )
  SELECT jsonb_build_object(
    'total_properties', total_properties,
    'total_units', total_units,
    'occupied_units', occupied_units,
    'monthly_revenue', monthly_revenue
  ) INTO v_property_stats
  FROM property_stats;

  -- Recent Payments (last 10)
  WITH recent_payments AS (
    SELECT 
      pay.id,
      pay.amount,
      pay.payment_date,
      pay.payment_method,
      pay.status,
      pay.payment_reference,
      COALESCE(t.first_name || ' ' || t.last_name, 'Unknown') as tenant_name,
      COALESCE(p.name, 'Unknown Property') as property_name,
      COALESCE(u.unit_number, 'N/A') as unit_number
    FROM public.payments pay
    LEFT JOIN public.leases l ON pay.lease_id = l.id
    LEFT JOIN public.units u ON l.unit_id = u.id
    LEFT JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.tenants t ON pay.tenant_id = t.id
    WHERE ((p.owner_id = _user_id OR p.manager_id = _user_id) 
           OR COALESCE(public.has_role_safe(_user_id, 'Admin'::public.app_role), public.has_role(_user_id, 'Admin'::public.app_role)))
      AND pay.status = 'completed'
    ORDER BY pay.payment_date DESC
    LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'amount', amount,
    'payment_date', payment_date,
    'payment_method', payment_method,
    'status', status,
    'payment_reference', payment_reference,
    'tenant_name', tenant_name,
    'property_name', property_name,
    'unit_number', unit_number
  )), '[]'::jsonb) INTO v_recent_payments
  FROM recent_payments;

  -- Pending Maintenance (high priority + recent)
  WITH pending_maintenance AS (
    SELECT 
      mr.id,
      mr.title,
      mr.priority,
      mr.submitted_date,
      mr.category,
      mr.status,
      COALESCE(p.name, 'Unknown Property') as property_name,
      COALESCE(u.unit_number, 'N/A') as unit_number,
      COALESCE(t.first_name || ' ' || t.last_name, 'Unknown') as tenant_name
    FROM public.maintenance_requests mr
    LEFT JOIN public.properties p ON mr.property_id = p.id
    LEFT JOIN public.units u ON mr.unit_id = u.id
    LEFT JOIN public.tenants t ON mr.tenant_id = t.id
    WHERE ((p.owner_id = _user_id OR p.manager_id = _user_id)
           OR COALESCE(public.has_role_safe(_user_id, 'Admin'::public.app_role), public.has_role(_user_id, 'Admin'::public.app_role)))
      AND mr.status IN ('pending', 'in_progress')
    ORDER BY 
      CASE WHEN mr.priority = 'high' THEN 1 
           WHEN mr.priority = 'medium' THEN 2 
           ELSE 3 END,
      mr.submitted_date DESC
    LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'title', title,
    'priority', priority,
    'submitted_date', submitted_date,
    'category', category,
    'status', status,
    'property_name', property_name,
    'unit_number', unit_number,
    'tenant_name', tenant_name
  )), '[]'::jsonb) INTO v_pending_maintenance
  FROM pending_maintenance;

  -- Combine all data
  v_result := jsonb_build_object(
    'property_stats', v_property_stats,
    'recent_payments', v_recent_payments,
    'pending_maintenance', v_pending_maintenance,
    'success', true,
    'timestamp', now()
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Return safe fallback on any error
  RETURN jsonb_build_object(
    'property_stats', jsonb_build_object(
      'total_properties', 0,
      'total_units', 0,
      'occupied_units', 0,
      'monthly_revenue', 0
    ),
    'recent_payments', '[]'::jsonb,
    'pending_maintenance', '[]'::jsonb,
    'success', false,
    'error', SQLERRM,
    'timestamp', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_landlord_dashboard_data(uuid) TO authenticated;