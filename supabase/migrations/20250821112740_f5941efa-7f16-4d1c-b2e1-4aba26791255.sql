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
  WITH revenue AS (
    SELECT COALESCE(SUM(p.amount), 0)::numeric AS total_revenue
    FROM public.payments p
    JOIN public.leases l ON p.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties prop ON u.property_id = prop.id
    WHERE (prop.owner_id = auth.uid() OR prop.manager_id = auth.uid())
      AND p.payment_date >= v_start
      AND p.payment_date <= v_end
      AND p.status = 'completed'
  ),
  expenses AS (
    SELECT COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  monthly_data AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
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
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM revenue),
      'total_expenses', (SELECT total_expenses FROM expenses),
      'net_profit', (SELECT total_revenue FROM revenue) - (SELECT total_expenses FROM expenses),
      'profit_margin', CASE 
        WHEN (SELECT total_revenue FROM revenue) > 0 
        THEN ROUND((((SELECT total_revenue FROM revenue) - (SELECT total_expenses FROM expenses)) / (SELECT total_revenue FROM revenue)) * 100, 1)
        ELSE 0 
      END
    ),
    'charts', jsonb_build_object(
      'monthly_comparison', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'revenue', revenue,
          'expenses', expenses,
          'profit', revenue - expenses
        ))
        FROM monthly_data
      ), '[]'::jsonb)
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$