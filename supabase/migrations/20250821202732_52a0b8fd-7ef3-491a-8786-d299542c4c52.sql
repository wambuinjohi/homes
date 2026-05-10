
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
  WITH relevant AS (
    SELECT 
      l.*,
      u.id AS unit_id,
      u.unit_number,
      p.id AS property_id,
      p.name AS property_name
    FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.properties p ON p.id = u.property_id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND l.lease_start_date <= v_end
      AND l.lease_end_date >= v_start
      AND COALESCE(l.status, 'active') <> 'terminated'
      AND l.monthly_rent IS NOT NULL
  ),
  market_benchmark AS (
    SELECT COALESCE(AVG(monthly_rent), 0)::numeric AS avg_market_rent
    FROM relevant
  ),
  per_property AS (
    SELECT 
      r.property_id,
      r.property_name,
      COALESCE(AVG(r.monthly_rent), 0)::numeric AS avg_current_rent,
      COUNT(*)::int AS unit_count
    FROM relevant r
    GROUP BY r.property_id, r.property_name
  ),
  stats AS (
    SELECT 
      COALESCE(AVG(r.monthly_rent), 0)::numeric AS avg_current_rent,
      (SELECT avg_market_rent FROM market_benchmark) AS avg_market_rent
    FROM relevant r
  ),
  variance_kpi AS (
    SELECT CASE 
      WHEN (SELECT avg_market_rent FROM market_benchmark) > 0 THEN
        ROUND((((SELECT avg_market_rent FROM market_benchmark) - (SELECT avg_current_rent FROM stats)) 
          / (SELECT avg_market_rent FROM market_benchmark)) * 100, 1)
      ELSE 0
    END AS rent_variance
  ),
  optimization AS (
    SELECT COALESCE(SUM(GREATEST((SELECT avg_market_rent FROM market_benchmark) - r.monthly_rent, 0)), 0)::numeric AS optimization_potential
    FROM relevant r
  ),
  rent_comparison AS (
    SELECT 
      pp.property_name AS property,
      pp.avg_current_rent AS current_rent,
      (SELECT avg_market_rent FROM market_benchmark) AS market_rent
    FROM per_property pp
  ),
  variance_analysis AS (
    SELECT 
      pp.property_name AS property,
      CASE 
        WHEN (SELECT avg_market_rent FROM market_benchmark) > 0 THEN
          ROUND((((SELECT avg_market_rent FROM market_benchmark) - pp.avg_current_rent) 
            / (SELECT avg_market_rent FROM market_benchmark)) * 100, 1)
        ELSE 0
      END AS variance
    FROM per_property pp
  ),
  table_rows AS (
    SELECT 
      pp.property_name,
      'N/A'::text AS unit_type,
      pp.avg_current_rent AS current_rent,
      (SELECT avg_market_rent FROM market_benchmark) AS market_rent,
      CASE 
        WHEN (SELECT avg_market_rent FROM market_benchmark) > 0 THEN
          ROUND((((SELECT avg_market_rent FROM market_benchmark) - pp.avg_current_rent) 
            / (SELECT avg_market_rent FROM market_benchmark)) * 100, 1)
        ELSE 0
      END AS variance
    FROM per_property pp
    ORDER BY pp.property_name
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'avg_market_rent', (SELECT avg_market_rent FROM stats),
      'avg_current_rent', (SELECT avg_current_rent FROM stats),
      'rent_variance', (SELECT rent_variance FROM variance_kpi),
      'optimization_potential', (SELECT optimization_potential FROM optimization)
    ),
    'charts', jsonb_build_object(
      'rent_comparison', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property,
          'current_rent', current_rent,
          'market_rent', market_rent
        ) ORDER BY property)
        FROM rent_comparison
      ), '[]'::jsonb),
      'variance_analysis', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property,
          'variance', variance
        ) ORDER BY property)
        FROM variance_analysis
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_type', unit_type,
        'current_rent', current_rent,
        'market_rent', market_rent,
        'variance', variance
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'kpis', jsonb_build_object(
        'avg_market_rent', 0,
        'avg_current_rent', 0,
        'rent_variance', 0,
        'optimization_potential', 0
      ),
      'charts', jsonb_build_object(),
      'table', '[]'::jsonb
    );
  END IF;

  RETURN v_result;
END;
$function$;
