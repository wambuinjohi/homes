
CREATE OR REPLACE FUNCTION public.get_property_performance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('year', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  -- Determine accessible properties for the current user (owner, manager, or Admin)
  WITH properties_access AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  -- Sum of completed payments (revenue) per property in the date range
  revenue_by_property AS (
    SELECT 
      pa.id AS property_id,
      COALESCE(SUM(pay.amount), 0)::numeric AS revenue
    FROM properties_access pa
    JOIN public.units u ON u.property_id = pa.id
    JOIN public.leases l ON l.unit_id = u.id
    JOIN public.payments pay ON pay.lease_id = l.id
    WHERE pay.status = 'completed'
      AND pay.payment_date >= v_start
      AND pay.payment_date <= v_end
    GROUP BY pa.id
  ),
  -- Sum of expenses per property in the date range
  expenses_by_property AS (
    SELECT 
      pa.id AS property_id,
      COALESCE(SUM(e.amount), 0)::numeric AS expenses
    FROM properties_access pa
    LEFT JOIN public.expenses e 
      ON e.property_id = pa.id
     AND e.expense_date >= v_start
     AND e.expense_date <= v_end
    GROUP BY pa.id
  ),
  -- Combine revenue and expenses per property and compute net income and yield
  combined AS (
    SELECT 
      pa.id AS property_id,
      pa.name AS property_name,
      COALESCE(r.revenue, 0)::numeric AS revenue,
      COALESCE(ex.expenses, 0)::numeric AS expenses,
      (COALESCE(r.revenue, 0) - COALESCE(ex.expenses, 0))::numeric AS net_income,
      CASE 
        WHEN COALESCE(r.revenue, 0) > 0 
          THEN ROUND(((COALESCE(r.revenue, 0) - COALESCE(ex.expenses, 0)) / COALESCE(r.revenue, 0)) * 100, 2)
        ELSE 0
      END::numeric AS yield
    FROM properties_access pa
    LEFT JOIN revenue_by_property r ON r.property_id = pa.id
    LEFT JOIN expenses_by_property ex ON ex.property_id = pa.id
  ),
  -- Totals and averages for KPIs
  totals AS (
    SELECT 
      COALESCE(SUM(revenue), 0)::numeric AS total_revenue,
      COALESCE(SUM(expenses), 0)::numeric AS total_expenses,
      COALESCE(SUM(net_income), 0)::numeric AS net_income,
      CASE 
        WHEN COUNT(*) > 0 
          THEN ROUND(AVG(CASE WHEN revenue > 0 THEN ((net_income / NULLIF(revenue, 0)) * 100) ELSE 0 END)::numeric, 2)
        ELSE 0 
      END AS avg_yield
    FROM combined
  ),
  -- Chart datasets
  revenue_vs_expenses_chart AS (
    SELECT property_name AS property, revenue, expenses
    FROM combined
    ORDER BY property_name
  ),
  yield_chart AS (
    SELECT property_name AS property, yield
    FROM combined
    ORDER BY property_name
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM totals),
      'total_expenses', (SELECT total_expenses FROM totals),
      'net_income', (SELECT net_income FROM totals),
      'avg_yield', (SELECT avg_yield FROM totals)
    ),
    'charts', jsonb_build_object(
      'revenue_vs_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property,
          'revenue', revenue,
          'expenses', expenses
        )) FROM revenue_vs_expenses_chart
      ), '[]'::jsonb),
      'yield_comparison', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property,
          'yield', yield
        )) FROM yield_chart
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'revenue', revenue,
        'expenses', expenses,
        'net_income', net_income,
        'yield', yield
      ) ORDER BY property_name)
      FROM combined
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
