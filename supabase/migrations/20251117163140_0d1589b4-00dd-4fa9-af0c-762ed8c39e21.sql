-- Update get_tenant_maintenance_data function to count 'resolved' status as completed
CREATE OR REPLACE FUNCTION public.get_tenant_maintenance_data(
  p_user_id uuid DEFAULT auth.uid(), 
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
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
      -- Count 'resolved' status as completed (landlords mark requests as resolved)
      COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as completed,
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