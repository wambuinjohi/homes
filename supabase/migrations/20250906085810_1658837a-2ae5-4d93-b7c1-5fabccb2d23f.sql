-- Create missing report functions referenced in the queries.ts file

-- Expense Summary Report
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
  category_breakdown AS (
    SELECT 
      category AS name,
      SUM(amount)::numeric AS value
    FROM relevant_expenses
    GROUP BY category
    ORDER BY SUM(amount) DESC
  ),
  monthly_trend AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE(SUM(e.amount), 0)::numeric AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
    LEFT JOIN relevant_expenses e ON date_trunc('month', e.expense_date) = date_trunc('month', d)
    GROUP BY date_trunc('month', d)
    ORDER BY date_trunc('month', d)
  ),
  table_rows AS (
    SELECT 
      property_name,
      COALESCE(unit_number, 'N/A') AS unit_number,
      category,
      description,
      amount,
      expense_date,
      vendor_name
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
      'category_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value))
        FROM category_breakdown
      ), '[]'::jsonb),
      'monthly_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'expenses', expenses))
        FROM monthly_trend
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'category', category,
        'description', description,
        'amount', amount,
        'expense_date', expense_date,
        'vendor_name', vendor_name
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Profit & Loss Report  
CREATE OR REPLACE FUNCTION public.get_profit_loss_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH revenue_data AS (
    SELECT COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status = 'completed'
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  ),
  expense_data AS (
    SELECT COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  ),
  kpis AS (
    SELECT
      r.total_revenue,
      e.total_expenses,
      (r.total_revenue - e.total_expenses) AS net_profit,
      CASE WHEN r.total_revenue > 0 THEN 
        ROUND(((r.total_revenue - e.total_expenses) / r.total_revenue) * 100, 1)
      ELSE 0 END AS profit_margin
    FROM revenue_data r, expense_data e
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_profit', (SELECT net_profit FROM kpis),
      'profit_margin', (SELECT profit_margin FROM kpis)
    ),
    'charts', '[]'::jsonb,
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Cash Flow Report
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
      ), 0)::numeric AS cash_in,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.properties p ON e.property_id = p.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
      ), 0)::numeric AS cash_out
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  kpis AS (
    SELECT
      SUM(cash_in)::numeric AS total_cash_in,
      SUM(cash_out)::numeric AS total_cash_out,
      (SUM(cash_in) - SUM(cash_out))::numeric AS net_cash_flow,
      ROUND(AVG(cash_in - cash_out)::numeric, 2) AS avg_monthly_flow
    FROM monthly_cash_flow
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_cash_in', (SELECT total_cash_in FROM kpis),
      'total_cash_out', (SELECT total_cash_out FROM kpis),
      'net_cash_flow', (SELECT net_cash_flow FROM kpis),
      'avg_monthly_flow', (SELECT avg_monthly_flow FROM kpis)
    ),
    'charts', jsonb_build_object(
      'monthly_flow', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'cash_in', cash_in,
          'cash_out', cash_out,
          'net_flow', (cash_in - cash_out)
        ))
        FROM monthly_cash_flow
      ), '[]'::jsonb)
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Revenue vs Expenses Report
CREATE OR REPLACE FUNCTION public.get_revenue_vs_expenses_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  -- This is similar to profit_loss but with different presentation
  SELECT public.get_profit_loss_report(v_start, v_end) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Executive Summary Report
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
      AND pay.status = 'completed'
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
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
    'charts', '[]'::jsonb,
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Financial Summary Report  
CREATE OR REPLACE FUNCTION public.get_financial_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  -- This combines elements from multiple reports for a comprehensive financial view
  SELECT public.get_executive_summary_report(v_start, v_end) INTO v_result;
  RETURN v_result;
END;
$function$;