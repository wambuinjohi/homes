-- Create Financial Summary Report Function
CREATE OR REPLACE FUNCTION public.get_financial_summary_report(
  p_start_date date DEFAULT NULL::date, 
  p_end_date date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('month', now() - interval '12 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH financial_data AS (
    -- Revenue from payments
    SELECT 
      COALESCE(SUM(pay.amount), 0)::numeric AS total_income,
      0::numeric AS total_expenses
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status = 'completed'
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
    
    UNION ALL
    
    -- Expenses
    SELECT 
      0::numeric AS total_income,
      COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
  ),
  totals AS (
    SELECT
      SUM(total_income)::numeric AS income,
      SUM(total_expenses)::numeric AS expenses,
      (SUM(total_income) - SUM(total_expenses))::numeric AS net_profit
    FROM financial_data
  ),
  kpis AS (
    SELECT
      income AS total_income,
      expenses AS total_expenses,
      net_profit,
      CASE 
        WHEN income > 0 THEN ROUND((net_profit / income) * 100, 1)
        ELSE 0 
      END AS profit_margin
    FROM totals
  ),
  monthly_data AS (
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
      ), 0)::numeric AS income,
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
  expense_categories AS (
    SELECT 
      COALESCE(e.category, 'Uncategorized') AS name,
      SUM(e.amount)::numeric AS value
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
    GROUP BY e.category
    ORDER BY value DESC
  ),
  table_data AS (
    SELECT 
      'Income' AS category,
      pay.payment_date::date AS transaction_date,
      pay.amount,
      CASE 
        WHEN (SELECT SUM(total_income) FROM totals) > 0 
        THEN ROUND((pay.amount / (SELECT SUM(total_income) FROM totals)) * 100, 1)
        ELSE 0 
      END AS percentage
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status = 'completed'
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
    
    UNION ALL
    
    SELECT 
      COALESCE(e.category, 'Expense') AS category,
      e.expense_date::date AS transaction_date,
      e.amount,
      CASE 
        WHEN (SELECT SUM(total_expenses) FROM totals) > 0 
        THEN ROUND((e.amount / (SELECT SUM(total_expenses) FROM totals)) * 100, 1)
        ELSE 0 
      END AS percentage
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'))
    ORDER BY transaction_date DESC, amount DESC
    LIMIT 100
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_income', (SELECT total_income FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_profit', (SELECT net_profit FROM kpis),
      'profit_margin', (SELECT profit_margin FROM kpis)
    ),
    'charts', jsonb_build_object(
      'income_vs_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'income', income,
          'expenses', expenses
        ))
        FROM monthly_data
      ), '[]'::jsonb),
      'expense_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', name,
          'value', value
        ))
        FROM expense_categories
        WHERE value > 0
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'transaction_date', transaction_date,
        'amount', amount,
        'percentage', percentage
      ))
      FROM table_data
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;