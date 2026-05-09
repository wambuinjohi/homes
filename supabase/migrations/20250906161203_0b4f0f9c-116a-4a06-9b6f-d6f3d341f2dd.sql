
-- 1) Fix Property Performance: aggregate revenue/expenses per property before combining (avoids double-counting)
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
  WITH properties_access AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
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

-- 2) Align Expense Summary SQL output to UI (chart ids + table field names)
CREATE OR REPLACE FUNCTION public.get_expense_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH relevant_expenses AS (
    SELECT 
      e.*,
      p.name AS property_name,
      u.unit_number
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    LEFT JOIN public.units u ON e.unit_id = u.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(amount), 0)::numeric AS total_expenses,
      COUNT(*)::int AS expense_count,
      ROUND(AVG(amount)::numeric, 2) AS avg_expense,
      COUNT(DISTINCT category)::int AS categories_used
    FROM relevant_expenses
  ),
  expense_categories AS (
    SELECT 
      COALESCE(NULLIF(category, ''), 'Uncategorized') AS name,
      SUM(amount)::numeric AS value
    FROM relevant_expenses
    GROUP BY 1
    ORDER BY SUM(amount) DESC
  ),
  monthly_expenses AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE(SUM(e.amount), 0)::numeric AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
    LEFT JOIN relevant_expenses e ON date_trunc('month', e.expense_date) = date_trunc('month', d)
    GROUP BY 1
    ORDER BY 1
  ),
  table_rows AS (
    SELECT 
      property_name,
      COALESCE(unit_number, 'N/A') AS unit_number,
      category AS expense_category,
      description,
      amount,
      expense_date,
      vendor_name AS vendor
    FROM relevant_expenses
    ORDER BY expense_date DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_expenses', (SELECT total_expenses FROM kpis),
      'expense_count', (SELECT expense_count FROM kpis),
      'avg_expense', (SELECT avg_expense FROM kpis),
      'categories_used', (SELECT categories_used FROM kpis)
    ),
    'charts', jsonb_build_object(
      'expense_categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value))
        FROM expense_categories
      ), '[]'::jsonb),
      'monthly_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'expenses', expenses))
        FROM monthly_expenses
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'expense_category', expense_category,
        'description', description,
        'amount', amount,
        'expense_date', expense_date,
        'vendor', vendor
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 3) Align Cash Flow Analysis to UI (kpi keys + chart ids + series names)
CREATE OR REPLACE FUNCTION public.get_cash_flow_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH monthly_cash_flow AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(pay.amount)
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status = 'completed'
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS inflow,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.properties p ON e.property_id = p.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS outflow
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  kpis AS (
    SELECT
      SUM(inflow)::numeric AS cash_inflow,
      SUM(outflow)::numeric AS cash_outflow,
      (SUM(inflow) - SUM(outflow))::numeric AS net_cash_flow,
      CASE WHEN SUM(inflow) > 0 THEN ROUND(((SUM(inflow) - SUM(outflow)) / SUM(inflow))::numeric * 100, 2) ELSE 0 END AS cash_flow_margin
    FROM monthly_cash_flow
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'cash_inflow', (SELECT cash_inflow FROM kpis),
      'cash_outflow', (SELECT cash_outflow FROM kpis),
      'net_cash_flow', (SELECT net_cash_flow FROM kpis),
      'cash_flow_margin', (SELECT cash_flow_margin FROM kpis)
    ),
    'charts', jsonb_build_object(
      'cash_flow_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'inflow', inflow,
          'outflow', outflow,
          'net', (inflow - outflow)
        ))
        FROM monthly_cash_flow
      ), '[]'::jsonb),
      'cash_flow_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'inflow', inflow,
          'outflow', outflow
        ))
        FROM monthly_cash_flow
      ), '[]'::jsonb)
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 4) Implement Revenue vs Expenses with monthly series + table (aligned to UI)
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
  WITH monthly AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(pay.amount)
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status IN ('completed','paid','success')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS revenue,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.properties p ON e.property_id = p.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  kpis AS (
    SELECT
      SUM(revenue)::numeric AS total_revenue,
      SUM(expenses)::numeric AS total_expenses,
      (SUM(revenue) - SUM(expenses))::numeric AS net_income,
      CASE WHEN SUM(revenue) > 0 THEN ROUND((SUM(expenses) / SUM(revenue))::numeric * 100, 2) ELSE 0 END AS expense_ratio
    FROM monthly
  ),
  table_rows AS (
    SELECT 
      (date_trunc('month', to_date(month, 'Mon')) + interval '1 month' - interval '1 day')::date AS report_date,
      month,
      revenue,
      expenses,
      (revenue - expenses) AS net_income
    FROM monthly
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_income', (SELECT net_income FROM kpis),
      'expense_ratio', (SELECT expense_ratio FROM kpis)
    ),
    'charts', jsonb_build_object(
      'monthly_comparison', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'revenue', revenue, 'expenses', expenses))
        FROM monthly
      ), '[]'::jsonb),
      'trend_analysis', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'net_income', (revenue - expenses)))
        FROM monthly
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'report_date', report_date,
        'month', month,
        'revenue', revenue,
        'expenses', expenses,
        'net_income', net_income
      ) ORDER BY report_date)
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 5) Enhance Executive Summary: add charts to match UI expectations
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
  WITH portfolio_overview AS (
    SELECT 
      COUNT(DISTINCT p.id)::int AS total_properties,
      COUNT(DISTINCT u.id)::int AS total_units,
      COUNT(DISTINCT CASE WHEN l.status = 'active' THEN u.id END)::int AS occupied_units
    FROM public.properties p
    LEFT JOIN public.units u ON p.id = u.property_id
    LEFT JOIN public.leases l ON u.id = l.unit_id AND l.status = 'active'
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  ),
  financial_summary AS (
    SELECT 
      COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.properties p ON e.property_id = p.id
        WHERE e.expense_date >= v_start AND e.expense_date <= v_end
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS total_expenses
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status IN ('completed','paid','success')
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  ),
  monthly AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(pay.amount)
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status IN ('completed','paid','success')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS revenue,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.properties p ON e.property_id = p.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  property_revenue AS (
    SELECT 
      p.name AS property_name,
      SUM(pay.amount)::numeric AS revenue
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status IN ('completed','paid','success')
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
    GROUP BY p.id, p.name
    ORDER BY revenue DESC
    LIMIT 10
  ),
  kpis AS (
    SELECT
      po.total_properties,
      po.total_units,
      po.occupied_units,
      CASE WHEN po.total_units > 0 THEN 
        ROUND((po.occupied_units::numeric / po.total_units::numeric) * 100, 1)
      ELSE 0 END AS occupancy_rate,
      fs.total_revenue,
      fs.total_expenses,
      (fs.total_revenue - fs.total_expenses) AS net_income
    FROM portfolio_overview po, financial_summary fs
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_properties', (SELECT total_properties FROM kpis),
      'total_units', (SELECT total_units FROM kpis),
      'occupancy_rate', (SELECT occupancy_rate FROM kpis),
      'total_revenue', (SELECT total_revenue FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_income', (SELECT net_income FROM kpis)
    ),
    'charts', jsonb_build_object(
      'portfolio_overview', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'revenue', revenue, 'expenses', expenses))
        FROM monthly
      ), '[]'::jsonb),
      'property_performance', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', property_name, 'value', revenue))
        FROM property_revenue
      ), '[]'::jsonb)
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 6) Minimal Market Rent function (prevents KPI calls from failing; can be enhanced later)
CREATE OR REPLACE FUNCTION public.get_market_rent_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- Placeholder structure with safe defaults
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'avg_market_rent', 0,
      'avg_current_rent', 0,
      'rent_variance', 0,
      'optimization_potential', 0,
      'properties_analyzed', 0
    ),
    'charts', jsonb_build_object(
      'rent_comparison', '[]'::jsonb,
      'variance_analysis', '[]'::jsonb
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
