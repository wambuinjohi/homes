-- Fix get_executive_summary_report to properly calculate revenue, expenses, and outstanding amounts
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
  WITH user_properties AS (
    SELECT p.id
    FROM public.properties p
    WHERE p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role)
  ),
  revenue_data AS (
    SELECT 
      COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue,
      COUNT(pay.id)::int AS payment_count
    FROM public.payments pay
    LEFT JOIN public.leases l ON pay.lease_id = l.id
    LEFT JOIN public.units u ON l.unit_id = u.id
    LEFT JOIN public.invoices inv ON pay.invoice_id = inv.id
    LEFT JOIN public.leases l2 ON inv.lease_id = l2.id
    LEFT JOIN public.units u2 ON l2.unit_id = u2.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status IN ('completed', 'paid', 'success')
      AND (
        (l.id IS NOT NULL AND u.property_id IN (SELECT id FROM user_properties)) OR
        (l2.id IS NOT NULL AND u2.property_id IN (SELECT id FROM user_properties))
      )
  ),
  expense_data AS (
    SELECT 
      COALESCE(SUM(e.amount), 0)::numeric AS total_expenses,
      COUNT(e.id)::int AS expense_count
    FROM public.expenses e
    WHERE e.property_id IN (SELECT id FROM user_properties)
      AND e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  outstanding_data AS (
    SELECT 
      COALESCE(SUM(
        GREATEST(
          inv.amount - COALESCE(
            (SELECT SUM(p.amount) FROM public.payments p 
             WHERE p.invoice_id = inv.id AND p.status = 'completed'), 0
          ), 0
        )
      ), 0)::numeric AS total_outstanding
    FROM public.invoices inv
    LEFT JOIN public.leases l ON inv.lease_id = l.id
    LEFT JOIN public.units u ON l.unit_id = u.id
    WHERE u.property_id IN (SELECT id FROM user_properties)
      AND inv.due_date <= v_end
  ),
  occupancy_data AS (
    SELECT 
      COUNT(DISTINCT u.id)::int AS total_units,
      COUNT(DISTINCT CASE 
        WHEN l.lease_start_date <= v_end 
        AND l.lease_end_date >= v_start 
        AND COALESCE(l.status, 'active') <> 'terminated' 
        THEN u.id 
      END)::int AS occupied_units
    FROM public.units u
    LEFT JOIN public.leases l ON l.unit_id = u.id
    WHERE u.property_id IN (SELECT id FROM user_properties)
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM revenue_data),
      'total_expenses', (SELECT total_expenses FROM expense_data),
      'net_operating_income', (SELECT total_revenue FROM revenue_data) - (SELECT total_expenses FROM expense_data),
      'total_outstanding', (SELECT total_outstanding FROM outstanding_data),
      'collection_rate', CASE 
        WHEN (SELECT total_revenue FROM revenue_data) + (SELECT total_outstanding FROM outstanding_data) > 0 THEN
          ROUND(((SELECT total_revenue FROM revenue_data) / 
            ((SELECT total_revenue FROM revenue_data) + (SELECT total_outstanding FROM outstanding_data))) * 100, 1)
        ELSE 0
      END,
      'occupancy_rate', CASE 
        WHEN (SELECT total_units FROM occupancy_data) > 0 THEN
          ROUND(((SELECT occupied_units FROM occupancy_data)::numeric / (SELECT total_units FROM occupancy_data)::numeric) * 100, 1)
        ELSE 0
      END,
      'payment_count', (SELECT payment_count FROM revenue_data),
      'expense_count', (SELECT expense_count FROM expense_data)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Fix get_market_rent_report to include properties_analyzed for data coverage calculation
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
  WITH user_properties AS (
    SELECT p.id, p.name, p.property_type
    FROM public.properties p
    WHERE p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role)
  ),
  properties_with_data AS (
    SELECT DISTINCT p.id, p.name, p.property_type
    FROM user_properties p
    JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    LEFT JOIN public.payments pay ON pay.lease_id = l.id
    WHERE pay.payment_date >= v_start AND pay.payment_date <= v_end
  ),
  rent_analysis AS (
    SELECT 
      p.property_type,
      AVG(l.monthly_rent)::numeric AS avg_rent,
      COUNT(DISTINCT l.id)::int AS lease_count
    FROM properties_with_data p
    JOIN public.units u ON u.property_id = p.id
    JOIN public.leases l ON l.unit_id = u.id
    WHERE l.lease_start_date <= v_end AND l.lease_end_date >= v_start
    GROUP BY p.property_type
  ),
  kpis AS (
    SELECT
      COUNT(DISTINCT pwd.id)::int AS properties_analyzed,
      (SELECT COUNT(*) FROM user_properties)::int AS total_properties,
      ROUND(AVG(ra.avg_rent)::numeric, 2) AS market_avg_rent,
      SUM(ra.lease_count)::int AS total_leases_analyzed
    FROM properties_with_data pwd
    LEFT JOIN rent_analysis ra ON TRUE
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'properties_analyzed', (SELECT properties_analyzed FROM kpis),
      'total_properties', (SELECT total_properties FROM kpis),
      'market_avg_rent', (SELECT COALESCE(market_avg_rent, 0) FROM kpis),
      'total_leases_analyzed', (SELECT COALESCE(total_leases_analyzed, 0) FROM kpis)
    ),
    'charts', jsonb_build_object(
      'rent_by_type', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property_type', property_type,
          'avg_rent', avg_rent,
          'lease_count', lease_count
        ))
        FROM rent_analysis
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', name,
        'property_type', property_type
      ))
      FROM properties_with_data
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;