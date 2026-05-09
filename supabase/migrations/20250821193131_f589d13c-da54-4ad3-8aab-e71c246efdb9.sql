
-- Replace Financial Summary report with admin-aware filters and monthly series

DROP FUNCTION IF EXISTS public.get_financial_summary_report(date, date);

CREATE OR REPLACE FUNCTION public.get_financial_summary_report(
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_start DATE := COALESCE(p_start_date, date_trunc('month', now())::date);
  v_end   DATE := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH monthly AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon YYYY') AS month,
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.status = 'completed'
          AND pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0) AS income,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE exp.expense_date >= date_trunc('month', d)
          AND exp.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0) AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  totals AS (
    SELECT 
      SUM(income)::numeric   AS total_income,
      SUM(expenses)::numeric AS total_expenses
    FROM monthly
  ),
  expense_breakdown AS (
    SELECT 
      COALESCE(exp.category, 'Other') AS category,
      SUM(exp.amount)::numeric AS amount
    FROM public.expenses exp
    JOIN public.properties p ON exp.property_id = p.id
    WHERE exp.expense_date >= v_start
      AND exp.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
    GROUP BY COALESCE(exp.category, 'Other')
  ),
  table_rows AS (
    SELECT 
      category,
      amount,
      CASE 
        WHEN (SELECT COALESCE(SUM(amount), 0) FROM expense_breakdown) > 0
          THEN ROUND((amount / (SELECT SUM(amount) FROM expense_breakdown)) * 100, 1)
        ELSE 0
      END AS percentage
    FROM expense_breakdown
    ORDER BY amount DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_income',     (SELECT total_income FROM totals),
      'total_expenses',   (SELECT total_expenses FROM totals),
      'net_profit',       (SELECT total_income - total_expenses FROM totals),
      'profit_margin',    CASE 
                            WHEN (SELECT total_income FROM totals) > 0 
                            THEN ROUND(((SELECT total_income - total_expenses FROM totals) / (SELECT total_income FROM totals)) * 100, 1)
                            ELSE 0 
                          END
    ),
    'charts', jsonb_build_object(
      'income_vs_expenses', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'month', month,
            'income', income,
            'expenses', expenses
          )
          ORDER BY to_date(month, 'Mon YYYY')
        )
        FROM monthly
      ), '[]'::jsonb),
      'expense_breakdown', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', category,
            'value', amount
          )
          ORDER BY amount DESC
        )
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
