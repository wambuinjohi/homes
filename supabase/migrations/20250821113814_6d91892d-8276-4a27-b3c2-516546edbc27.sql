-- Revenue vs Expenses Report
CREATE OR REPLACE FUNCTION public.get_revenue_vs_expenses_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH monthly_comparison AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon YYYY') AS period,
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          AND pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status = 'completed'
      ), 0) AS revenue,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          AND exp.expense_date >= date_trunc('month', d)
          AND exp.expense_date < (date_trunc('month', d) + interval '1 month')
      ), 0) AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  totals AS (
    SELECT 
      SUM(revenue)::numeric AS total_revenue,
      SUM(expenses)::numeric AS total_expenses,
      ROUND(AVG(revenue)::numeric, 2) AS avg_monthly_revenue,
      ROUND(AVG(expenses)::numeric, 2) AS avg_monthly_expenses
    FROM monthly_comparison
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM totals),
      'total_expenses', (SELECT total_expenses FROM totals),
      'avg_monthly_revenue', (SELECT avg_monthly_revenue FROM totals),
      'avg_monthly_expenses', (SELECT avg_monthly_expenses FROM totals)
    ),
    'charts', jsonb_build_object(
      'revenue_vs_expenses_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'period', period,
          'revenue', revenue,
          'expenses', expenses
        ))
        FROM monthly_comparison
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue', revenue,
        'expenses', expenses,
        'net_profit', revenue - expenses
      ))
      FROM monthly_comparison
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Property Performance Report
CREATE OR REPLACE FUNCTION public.get_property_performance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH property_metrics AS (
    SELECT 
      p.name AS property_name,
      COUNT(DISTINCT u.id)::int AS total_units,
      COUNT(DISTINCT CASE WHEN l.lease_end_date >= current_date THEN l.id END)::int AS occupied_units,
      COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue,
      COALESCE(SUM(exp.amount), 0)::numeric AS total_expenses,
      CASE 
        WHEN COUNT(DISTINCT u.id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN l.lease_end_date >= current_date THEN l.id END)::numeric / COUNT(DISTINCT u.id)::numeric) * 100, 1)
        ELSE 0 
      END AS occupancy_rate
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id AND l.status = 'active'
    LEFT JOIN public.payments pay ON pay.lease_id = l.id 
      AND pay.payment_date >= v_start 
      AND pay.payment_date <= v_end 
      AND pay.status = 'completed'
    LEFT JOIN public.expenses exp ON exp.property_id = p.id 
      AND exp.expense_date >= v_start 
      AND exp.expense_date <= v_end
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    GROUP BY p.id, p.name
  ),
  totals AS (
    SELECT 
      COUNT(*)::int AS total_properties,
      COALESCE(AVG(occupancy_rate), 0)::numeric AS avg_occupancy_rate,
      SUM(total_revenue)::numeric AS portfolio_revenue,
      SUM(total_expenses)::numeric AS portfolio_expenses
    FROM property_metrics
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_properties', (SELECT total_properties FROM totals),
      'avg_occupancy_rate', (SELECT avg_occupancy_rate FROM totals),
      'portfolio_revenue', (SELECT portfolio_revenue FROM totals),
      'portfolio_expenses', (SELECT portfolio_expenses FROM totals)
    ),
    'charts', jsonb_build_object(
      'property_performance', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property_name,
          'occupancy_rate', occupancy_rate,
          'revenue', total_revenue
        ))
        FROM property_metrics
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'total_units', total_units,
        'occupied_units', occupied_units,
        'occupancy_rate', occupancy_rate,
        'revenue', total_revenue,
        'expenses', total_expenses,
        'net_profit', total_revenue - total_expenses
      ))
      FROM property_metrics
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;