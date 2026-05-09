-- Create market rent analysis function
CREATE OR REPLACE FUNCTION public.get_market_rent_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH property_rents AS (
    SELECT 
      p.name AS property_name,
      AVG(l.monthly_rent)::numeric AS avg_rent,
      COUNT(l.id) AS lease_count,
      p.property_type
    FROM public.properties p
    JOIN public.units u ON u.property_id = p.id
    JOIN public.leases l ON l.unit_id = u.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND l.lease_start_date >= v_start
      AND l.lease_start_date <= v_end
      AND COALESCE(l.status, 'active') <> 'terminated'
    GROUP BY p.id, p.name, p.property_type
  ),
  market_analysis AS (
    SELECT
      COUNT(DISTINCT property_name)::int AS properties_analyzed,
      ROUND(AVG(avg_rent)::numeric, 2) AS market_avg_rent,
      MIN(avg_rent)::numeric AS min_rent,
      MAX(avg_rent)::numeric AS max_rent,
      COALESCE(SUM(lease_count), 0)::int AS total_units_analyzed
    FROM property_rents
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'properties_analyzed', (SELECT properties_analyzed FROM market_analysis),
      'market_avg_rent', (SELECT COALESCE(market_avg_rent, 0) FROM market_analysis),
      'min_rent', (SELECT COALESCE(min_rent, 0) FROM market_analysis),
      'max_rent', (SELECT COALESCE(max_rent, 0) FROM market_analysis)
    ),
    'charts', jsonb_build_object(
      'rent_distribution', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property_name', property_name,
          'avg_rent', avg_rent,
          'property_type', property_type
        ))
        FROM property_rents
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'avg_rent', avg_rent,
        'lease_count', lease_count,
        'property_type', property_type
      ) ORDER BY avg_rent DESC)
      FROM property_rents
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$