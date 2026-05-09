-- Fix Lease Expiry report with admin-aware filters

DROP FUNCTION IF EXISTS public.get_lease_expiry_report(date, date);

CREATE OR REPLACE FUNCTION public.get_lease_expiry_report(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, now()::date);
  v_end   date := COALESCE(p_end_date, (now() + interval '90 days')::date);
  v_result jsonb;
BEGIN
  WITH relevant AS (
    SELECT 
      l.*,
      u.unit_number,
      p.name AS property_name,
      t.first_name,
      t.last_name
    FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.properties p ON p.id = u.property_id
    LEFT JOIN public.tenants t ON t.id = l.tenant_id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND l.lease_end_date BETWEEN v_start AND v_end
  ),
  kpis AS (
    SELECT
      COUNT(*)::int AS expiring_leases,
      0::numeric AS renewal_rate, -- Placeholder (requires explicit renewal tracking)
      ROUND(AVG(EXTRACT(EPOCH FROM (lease_end_date - lease_start_date)) / 86400)::numeric, 1) AS avg_lease_duration_days,
      COALESCE(SUM(monthly_rent), 0)::numeric AS potential_revenue_loss
    FROM relevant
  ),
  expiry_timeline AS (
    SELECT 
      to_char(date_trunc('month', lease_end_date), 'Mon YYYY') AS month,
      COUNT(*)::int AS expiring
    FROM relevant
    GROUP BY date_trunc('month', lease_end_date)
    ORDER BY date_trunc('month', lease_end_date)
  ),
  table_rows AS (
    SELECT 
      property_name,
      unit_number,
      (COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))::text AS tenant_name,
      lease_end_date,
      monthly_rent,
      GREATEST((lease_end_date - current_date), 0)::int AS days_until_expiry
    FROM relevant
    ORDER BY lease_end_date
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'expiring_leases', (SELECT expiring_leases FROM kpis),
      'renewal_rate', (SELECT renewal_rate FROM kpis),
      'potential_revenue_loss', (SELECT potential_revenue_loss FROM kpis),
      'avg_lease_duration', (SELECT COALESCE(avg_lease_duration_days, 0) FROM kpis)
    ),
    'charts', jsonb_build_object(
      'expiry_timeline', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'expiring', expiring))
        FROM expiry_timeline
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'tenant_name', tenant_name,
        'lease_end_date', lease_end_date,
        'monthly_rent', monthly_rent,
        'days_until_expiry', days_until_expiry
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;