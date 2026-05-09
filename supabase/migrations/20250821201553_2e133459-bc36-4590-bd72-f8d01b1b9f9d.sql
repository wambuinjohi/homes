-- Executive Summary Report Function
CREATE OR REPLACE FUNCTION public.get_executive_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('month', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH accessible_properties AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  property_count AS (
    SELECT COUNT(*)::integer AS total_properties
    FROM accessible_properties
  ),
  unit_count AS (
    SELECT COUNT(u.id)::integer AS total_units
    FROM accessible_properties ap
    JOIN public.units u ON u.property_id = ap.id
  ),
  occupied_units AS (
    SELECT COUNT(DISTINCT u.id)::integer AS occupied_units
    FROM accessible_properties ap
    JOIN public.units u ON u.property_id = ap.id
    JOIN public.leases l ON l.unit_id = u.id
    WHERE l.lease_start_date <= v_end
      AND l.lease_end_date >= v_start
      AND COALESCE(l.status, 'active') <> 'terminated'
  ),
  total_revenue AS (
    SELECT COALESCE(SUM(pay.amount), 0)::numeric AS amount
    FROM accessible_properties ap
    JOIN public.units u ON u.property_id = ap.id
    JOIN public.leases l ON l.unit_id = u.id
    JOIN public.payments pay ON pay.lease_id = l.id
    WHERE pay.status = 'completed'
      AND pay.payment_date >= v_start
      AND pay.payment_date <= v_end
  ),
  kpis AS (
    SELECT
      pc.total_properties,
      uc.total_units,
      ou.occupied_units,
      tr.amount AS total_revenue
    FROM property_count pc
    CROSS JOIN unit_count uc
    CROSS JOIN occupied_units ou
    CROSS JOIN total_revenue tr
  ),
  monthly_revenue AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM accessible_properties ap
        JOIN public.units u ON u.property_id = ap.id
        JOIN public.leases l ON l.unit_id = u.id
        JOIN public.payments pay ON pay.lease_id = l.id
        WHERE pay.status = 'completed'
          AND pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
      ), 0) AS revenue
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  portfolio_overview AS (
    SELECT 
      ap.name AS property_name,
      COUNT(u.id)::integer AS total_units,
      COALESCE(COUNT(CASE WHEN l.id IS NOT NULL AND l.lease_start_date <= v_end AND l.lease_end_date >= v_start AND COALESCE(l.status, 'active') <> 'terminated' THEN 1 END), 0)::integer AS occupied_units,
      COALESCE(SUM(pay.amount), 0)::numeric AS revenue
    FROM accessible_properties ap
    LEFT JOIN public.units u ON u.property_id = ap.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    LEFT JOIN public.payments pay ON pay.lease_id = l.id AND pay.status = 'completed' AND pay.payment_date >= v_start AND pay.payment_date <= v_end
    GROUP BY ap.id, ap.name
    ORDER BY revenue DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_properties', (SELECT total_properties FROM kpis),
      'total_units', (SELECT total_units FROM kpis),
      'occupied_units', (SELECT occupied_units FROM kpis),
      'total_revenue', (SELECT total_revenue FROM kpis)
    ),
    'charts', jsonb_build_object(
      'revenue_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'revenue', revenue
        ))
        FROM monthly_revenue
      ), '[]'::jsonb),
      'portfolio_performance', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property_name', property_name,
          'revenue', revenue
        ))
        FROM portfolio_overview
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'total_units', total_units,
        'occupied_units', occupied_units,
        'revenue', revenue
      ))
      FROM portfolio_overview
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Market Rent Analysis Report Function
CREATE OR REPLACE FUNCTION public.get_market_rent_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('month', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH accessible_properties AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  current_rents AS (
    SELECT 
      l.monthly_rent,
      u.unit_number,
      ap.name AS property_name
    FROM accessible_properties ap
    JOIN public.units u ON u.property_id = ap.id
    JOIN public.leases l ON l.unit_id = u.id
    WHERE l.lease_start_date <= v_end
      AND l.lease_end_date >= v_start
      AND COALESCE(l.status, 'active') <> 'terminated'
  ),
  kpis AS (
    SELECT
      COALESCE(ROUND(AVG(monthly_rent)::numeric, 2), 0) AS avg_market_rent,
      COALESCE(MIN(monthly_rent), 0)::numeric AS min_rent,
      COALESCE(MAX(monthly_rent), 0)::numeric AS max_rent,
      COUNT(*)::integer AS active_leases
    FROM current_rents
  ),
  rent_distribution AS (
    SELECT 
      CASE 
        WHEN monthly_rent < 500 THEN 'Under $500'
        WHEN monthly_rent < 1000 THEN '$500-$999'
        WHEN monthly_rent < 1500 THEN '$1000-$1499'
        WHEN monthly_rent < 2000 THEN '$1500-$1999'
        ELSE '$2000+'
      END AS rent_range,
      COUNT(*)::integer AS count
    FROM current_rents
    GROUP BY 1
    ORDER BY MIN(monthly_rent)
  ),
  property_comparison AS (
    SELECT 
      property_name,
      COALESCE(ROUND(AVG(monthly_rent)::numeric, 2), 0) AS avg_rent,
      COUNT(*)::integer AS unit_count
    FROM current_rents
    GROUP BY property_name
    ORDER BY avg_rent DESC
  ),
  table_rows AS (
    SELECT 
      property_name,
      unit_number,
      monthly_rent,
      CASE 
        WHEN monthly_rent > (SELECT avg_market_rent FROM kpis) THEN 'Above Market'
        WHEN monthly_rent < (SELECT avg_market_rent FROM kpis) THEN 'Below Market'
        ELSE 'At Market'
      END AS market_position
    FROM current_rents
    ORDER BY monthly_rent DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'avg_market_rent', (SELECT avg_market_rent FROM kpis),
      'min_rent', (SELECT min_rent FROM kpis),
      'max_rent', (SELECT max_rent FROM kpis),
      'active_leases', (SELECT active_leases FROM kpis)
    ),
    'charts', jsonb_build_object(
      'rent_distribution', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'rent_range', rent_range,
          'count', count
        ))
        FROM rent_distribution
      ), '[]'::jsonb),
      'property_comparison', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property_name', property_name,
          'avg_rent', avg_rent
        ))
        FROM property_comparison
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'monthly_rent', monthly_rent,
        'market_position', market_position
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;