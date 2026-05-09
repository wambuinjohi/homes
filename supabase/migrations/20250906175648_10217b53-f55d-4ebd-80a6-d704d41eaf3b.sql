-- Create function to get platform-wide market rent analysis (anonymized and aggregated)
CREATE OR REPLACE FUNCTION public.get_platform_market_rent(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  -- Get aggregated market data from all active leases (anonymized)
  WITH platform_leases AS (
    SELECT 
      l.monthly_rent,
      u.unit_type,
      p.city,
      p.state,
      EXTRACT(YEAR FROM l.lease_start_date) AS lease_year
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.lease_start_date >= v_start
      AND l.lease_start_date <= v_end
      AND l.monthly_rent > 0
      AND COALESCE(l.status, 'active') <> 'terminated'
  ),
  rent_by_type AS (
    SELECT 
      COALESCE(unit_type, 'Unknown') AS unit_type,
      COUNT(*)::int AS unit_count,
      ROUND(AVG(monthly_rent)::numeric, 2) AS avg_rent,
      ROUND(MIN(monthly_rent)::numeric, 2) AS min_rent,
      ROUND(MAX(monthly_rent)::numeric, 2) AS max_rent,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY monthly_rent)::numeric, 2) AS median_rent
    FROM platform_leases
    GROUP BY unit_type
    HAVING COUNT(*) >= 3 -- Only show types with at least 3 data points for privacy
  ),
  rent_by_location AS (
    SELECT 
      COALESCE(city, 'Unknown') AS city,
      COALESCE(state, 'Unknown') AS state,
      COUNT(*)::int AS unit_count,
      ROUND(AVG(monthly_rent)::numeric, 2) AS avg_rent
    FROM platform_leases
    GROUP BY city, state
    HAVING COUNT(*) >= 5 -- Only show locations with at least 5 data points for privacy
    ORDER BY avg_rent DESC
    LIMIT 10
  ),
  yearly_trends AS (
    SELECT 
      lease_year,
      COUNT(*)::int AS lease_count,
      ROUND(AVG(monthly_rent)::numeric, 2) AS avg_rent
    FROM platform_leases
    WHERE lease_year IS NOT NULL
    GROUP BY lease_year
    ORDER BY lease_year
  ),
  kpis AS (
    SELECT
      COUNT(DISTINCT unit_type)::int AS unit_types_analyzed,
      COUNT(DISTINCT CONCAT(city, '|', state))::int AS locations_analyzed,
      COUNT(*)::int AS total_sample_size,
      ROUND(AVG(monthly_rent)::numeric, 2) AS platform_avg_rent,
      ROUND(STDDEV(monthly_rent)::numeric, 2) AS rent_std_dev
    FROM platform_leases
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'platform_avg_rent', (SELECT platform_avg_rent FROM kpis),
      'total_sample_size', (SELECT total_sample_size FROM kpis),
      'unit_types_analyzed', (SELECT unit_types_analyzed FROM kpis),
      'locations_analyzed', (SELECT locations_analyzed FROM kpis),
      'rent_variance', (SELECT COALESCE(rent_std_dev, 0) FROM kpis)
    ),
    'charts', jsonb_build_object(
      'rent_by_type', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'unit_type', unit_type,
          'avg_rent', avg_rent,
          'min_rent', min_rent,
          'max_rent', max_rent,
          'median_rent', median_rent,
          'sample_size', unit_count
        ))
        FROM rent_by_type
      ), '[]'::jsonb),
      'rent_by_location', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'location', city || ', ' || state,
          'avg_rent', avg_rent,
          'sample_size', unit_count
        ))
        FROM rent_by_location
      ), '[]'::jsonb),
      'yearly_trends', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'year', lease_year,
          'avg_rent', avg_rent,
          'lease_count', lease_count
        ))
        FROM yearly_trends
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'unit_type', unit_type,
        'avg_rent', avg_rent,
        'median_rent', median_rent,
        'min_rent', min_rent,
        'max_rent', max_rent,
        'sample_size', unit_count
      ))
      FROM rent_by_type
      ORDER BY avg_rent DESC
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;