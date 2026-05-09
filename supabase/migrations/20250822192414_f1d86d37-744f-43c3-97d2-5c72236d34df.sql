
-- Fix over-counting in landlord dashboard RPC by using DISTINCT and counting units directly
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
      COUNT(DISTINCT p.id)::int AS total_properties,
      COUNT(DISTINCT u.id)::int AS total_units,
      COUNT(DISTINCT l.unit_id)::int AS occupied_units,
      COALESCE(
        SUM(
          CASE 
            WHEN COALESCE(l.status, 'active') = 'active' THEN l.monthly_rent 
            ELSE 0 
          END
        ), 
        0
      )::numeric AS monthly_revenue
    FROM public.properties p
    LEFT JOIN public.units u 
      ON u.property_id = p.id
    LEFT JOIN public.leases l 
      ON l.unit_id = u.id
    WHERE (p.owner_id = p_user_id OR p.manager_id = p_user_id)
  ),
  recent_payments AS (
    SELECT 
      py.id, py.amount, py.payment_date, py.payment_method,
      py.status, py.payment_reference,
      t.first_name || ' ' || t.last_name AS tenant_name,
      p.name AS property_name, u.unit_number
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
      p.name AS property_name, u.unit_number,
      t.first_name || ' ' || t.last_name AS tenant_name
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
