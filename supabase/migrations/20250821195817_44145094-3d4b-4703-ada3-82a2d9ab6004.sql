CREATE OR REPLACE FUNCTION public.get_tenant_turnover_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, (now() - interval '12 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH ended_leases AS (
    SELECT 
      l.*,
      u.unit_number,
      p.name AS property_name,
      t.first_name,
      t.last_name,
      EXTRACT(EPOCH FROM (l.lease_end_date - l.lease_start_date)) / 86400 AS tenancy_days
    FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.properties p ON p.id = u.property_id
    LEFT JOIN public.tenants t ON t.id = l.tenant_id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND l.lease_end_date BETWEEN v_start AND v_end
      AND COALESCE(l.status, 'active') = 'terminated'
  ),
  new_leases AS (
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
      AND l.lease_start_date BETWEEN v_start AND v_end
      AND COALESCE(l.status, 'active') <> 'terminated'
  ),
  total_units AS (
    SELECT COUNT(u.id)::numeric AS unit_count
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  kpis AS (
    SELECT
      COUNT(*)::int AS departed_tenants,
      (SELECT COUNT(*)::int FROM new_leases) AS new_tenants,
      ROUND(AVG(tenancy_days)::numeric, 1) AS avg_tenancy_duration,
      CASE 
        WHEN (SELECT unit_count FROM total_units) > 0 THEN
          ROUND((COUNT(*)::numeric / (SELECT unit_count FROM total_units)) * 100, 1)
        ELSE 0
      END AS turnover_rate
    FROM ended_leases
  ),
  monthly_turnover AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT COUNT(*)
        FROM ended_leases el
        WHERE el.lease_end_date >= date_trunc('month', d)
          AND el.lease_end_date < (date_trunc('month', d) + interval '1 month')
      ), 0)::int AS departures,
      COALESCE((
        SELECT COUNT(*)
        FROM new_leases nl
        WHERE nl.lease_start_date >= date_trunc('month', d)
          AND nl.lease_start_date < (date_trunc('month', d) + interval '1 month')
      ), 0)::int AS new_tenants
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  table_rows AS (
    SELECT 
      property_name,
      unit_number,
      (COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))::text AS tenant_name,
      lease_start_date,
      lease_end_date,
      tenancy_days::int AS tenancy_duration
    FROM ended_leases
    ORDER BY lease_end_date DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'departed_tenants', (SELECT departed_tenants FROM kpis),
      'new_tenants', (SELECT new_tenants FROM kpis),
      'avg_tenancy_duration', (SELECT COALESCE(avg_tenancy_duration, 0) FROM kpis),
      'turnover_rate', (SELECT turnover_rate FROM kpis)
    ),
    'charts', jsonb_build_object(
      'turnover_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'departures', departures,
          'new_tenants', new_tenants
        ))
        FROM monthly_turnover
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'tenant_name', tenant_name,
        'lease_start_date', lease_start_date,
        'lease_end_date', lease_end_date,
        'tenancy_duration', tenancy_duration
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$