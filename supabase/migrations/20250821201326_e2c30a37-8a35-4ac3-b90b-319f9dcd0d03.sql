
CREATE OR REPLACE FUNCTION public.get_profit_loss_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  revenue_total AS (
    SELECT COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue
    FROM accessible_properties ap
    JOIN public.units u ON u.property_id = ap.id
    JOIN public.leases l ON l.unit_id = u.id
    JOIN public.payments pay ON pay.lease_id = l.id
    WHERE pay.status = 'completed'
      AND pay.payment_date >= v_start
      AND pay.payment_date <= v_end
  ),
  expenses_total AS (
    SELECT COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
    FROM accessible_properties ap
    JOIN public.expenses e ON e.property_id = ap.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  kpis AS (
    SELECT
      rt.total_revenue,
      et.total_expenses,
      (rt.total_revenue - et.total_expenses)::numeric AS gross_profit,
      CASE 
        WHEN rt.total_revenue > 0 
          THEN ROUND(((rt.total_revenue - et.total_expenses) / rt.total_revenue) * 100, 1)
        ELSE 0 
      END AS profit_margin
    FROM revenue_total rt
    CROSS JOIN expenses_total et
  ),
  monthly_pnl AS (
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
  monthly_pnl_with_profit AS (
    SELECT month, revenue, expenses, (revenue - expenses)::numeric AS profit
    FROM monthly_pnl
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
  expense_total AS (
    SELECT COALESCE(SUM(value), 0)::numeric AS total
    FROM expense_breakdown
  ),
  table_rows AS (
    SELECT 
      eb.name AS category,
      eb.value AS amount,
      CASE 
        WHEN et.total > 0 THEN ROUND((eb.value / et.total) * 100, 1) 
        ELSE 0 
      END AS percentage
    FROM expense_breakdown eb
    CROSS JOIN expense_total et
    ORDER BY amount DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'gross_profit', (SELECT gross_profit FROM kpis),
      'profit_margin', (SELECT profit_margin FROM kpis)
    ),
    'charts', jsonb_build_object(
      'monthly_pnl', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'revenue', revenue,
          'expenses', expenses,
          'profit', profit
        ))
        FROM monthly_pnl_with_profit
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
        'amount', amount,
        'percentage', percentage
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
