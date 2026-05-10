-- Financial Summary Report Function
CREATE OR REPLACE FUNCTION public.get_financial_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH accessible_properties AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  total_income AS (
    SELECT COALESCE(SUM(pay.amount), 0)::numeric AS amount
    FROM accessible_properties ap
    JOIN public.units u ON u.property_id = ap.id
    JOIN public.leases l ON l.unit_id = u.id
    JOIN public.payments pay ON pay.lease_id = l.id
    WHERE pay.status = 'completed'
      AND pay.payment_date >= v_start
      AND pay.payment_date <= v_end
  ),
  total_expenses AS (
    SELECT COALESCE(SUM(e.amount), 0)::numeric AS amount
    FROM accessible_properties ap
    JOIN public.expenses e ON e.property_id = ap.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  kpis AS (
    SELECT
      ti.amount AS total_income,
      te.amount AS total_expenses,
      (ti.amount - te.amount)::numeric AS net_profit,
      CASE 
        WHEN ti.amount > 0 
          THEN ROUND(((ti.amount - te.amount) / ti.amount) * 100, 1)
        ELSE 0 
      END AS profit_margin
    FROM total_income ti
    CROSS JOIN total_expenses te
  ),
  monthly_income AS (
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
      ), 0) AS income
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  income_breakdown AS (
    SELECT 
      COALESCE(NULLIF(pay.payment_type, ''), 'Rent')::text AS name,
      COALESCE(SUM(pay.amount), 0)::numeric AS value
    FROM accessible_properties ap
    JOIN public.units u ON u.property_id = ap.id
    JOIN public.leases l ON l.unit_id = u.id
    JOIN public.payments pay ON pay.lease_id = l.id
    WHERE pay.status = 'completed'
      AND pay.payment_date >= v_start
      AND pay.payment_date <= v_end
    GROUP BY 1
    ORDER BY value DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_income', (SELECT total_income FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_profit', (SELECT net_profit FROM kpis),
      'profit_margin', (SELECT profit_margin FROM kpis)
    ),
    'charts', jsonb_build_object(
      'monthly_income', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'income', income
        ))
        FROM monthly_income
      ), '[]'::jsonb),
      'income_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', name,
          'value', value
        ))
        FROM income_breakdown
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', month,
        'income', income
      ))
      FROM monthly_income
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Expense Summary Report Function
CREATE OR REPLACE FUNCTION public.get_expense_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH accessible_properties AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  total_expenses AS (
    SELECT COALESCE(SUM(e.amount), 0)::numeric AS amount
    FROM accessible_properties ap
    JOIN public.expenses e ON e.property_id = ap.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  expense_count AS (
    SELECT COUNT(*)::integer AS count
    FROM accessible_properties ap
    JOIN public.expenses e ON e.property_id = ap.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  kpis AS (
    SELECT
      te.amount AS total_expenses,
      ec.count AS expense_count,
      CASE WHEN ec.count > 0 THEN ROUND(te.amount / ec.count, 2) ELSE 0 END AS avg_expense,
      COALESCE((
        SELECT SUM(e.amount)::numeric
        FROM accessible_properties ap
        JOIN public.expenses e ON e.property_id = ap.id
        WHERE e.expense_date >= (v_end - interval '30 days')
          AND e.expense_date <= v_end
      ), 0) AS monthly_expenses
    FROM total_expenses te
    CROSS JOIN expense_count ec
  ),
  monthly_expenses AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(e.amount)::numeric
        FROM accessible_properties ap
        JOIN public.expenses e ON e.property_id = ap.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
      ), 0) AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  expense_breakdown AS (
    SELECT 
      COALESCE(NULLIF(e.category, ''), 'Uncategorized')::text AS name,
      COALESCE(SUM(e.amount), 0)::numeric AS value
    FROM accessible_properties ap
    JOIN public.expenses e ON e.property_id = ap.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
    GROUP BY 1
    ORDER BY value DESC
  ),
  table_rows AS (
    SELECT 
      COALESCE(NULLIF(e.category, ''), 'Uncategorized')::text AS category,
      ap.name AS property_name,
      e.amount,
      e.expense_date,
      COALESCE(e.vendor_name, 'N/A')::text AS vendor
    FROM accessible_properties ap
    JOIN public.expenses e ON e.property_id = ap.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
    ORDER BY e.expense_date DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_expenses', (SELECT total_expenses FROM kpis),
      'expense_count', (SELECT expense_count FROM kpis),
      'avg_expense', (SELECT avg_expense FROM kpis),
      'monthly_expenses', (SELECT monthly_expenses FROM kpis)
    ),
    'charts', jsonb_build_object(
      'monthly_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'expenses', expenses
        ))
        FROM monthly_expenses
      ), '[]'::jsonb),
      'expense_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', name,
          'value', value
        ))
        FROM expense_breakdown
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'property_name', property_name,
        'amount', amount,
        'expense_date', expense_date,
        'vendor', vendor
      ))
      FROM table_rows
      LIMIT 100
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Revenue vs Expenses Report Function  
CREATE OR REPLACE FUNCTION public.get_revenue_vs_expenses_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH accessible_properties AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
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
  total_expenses AS (
    SELECT COALESCE(SUM(e.amount), 0)::numeric AS amount
    FROM accessible_properties ap
    JOIN public.expenses e ON e.property_id = ap.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  kpis AS (
    SELECT
      tr.amount AS total_revenue,
      te.amount AS total_expenses,
      (tr.amount - te.amount)::numeric AS net_income,
      CASE 
        WHEN tr.amount > 0 
          THEN ROUND((te.amount / tr.amount) * 100, 1)
        ELSE 0 
      END AS expense_ratio
    FROM total_revenue tr
    CROSS JOIN total_expenses te
  ),
  monthly_comparison AS (
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
      ), 0) AS revenue,
      COALESCE((
        SELECT SUM(e.amount)::numeric
        FROM accessible_properties ap
        JOIN public.expenses e ON e.property_id = ap.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
      ), 0) AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  revenue_vs_expenses AS (
    SELECT 'Revenue'::text AS name, (SELECT amount FROM total_revenue) AS value
    UNION ALL
    SELECT 'Expenses', (SELECT amount FROM total_expenses)
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
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'revenue', revenue,
          'expenses', expenses
        ))
        FROM monthly_comparison
      ), '[]'::jsonb),
      'revenue_vs_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', name,
          'value', value
        ))
        FROM revenue_vs_expenses
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', month,
        'revenue', revenue,
        'expenses', expenses,
        'net_income', (revenue - expenses)
      ))
      FROM monthly_comparison
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;