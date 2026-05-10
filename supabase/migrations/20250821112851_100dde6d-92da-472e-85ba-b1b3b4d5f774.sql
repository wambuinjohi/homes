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
  WITH income_data AS (
    SELECT 
      'Rental Income' AS category,
      COALESCE(SUM(p.amount), 0)::numeric AS amount
    FROM public.payments p
    JOIN public.leases l ON p.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties prop ON u.property_id = prop.id
    WHERE (prop.owner_id = auth.uid() OR prop.manager_id = auth.uid())
      AND p.payment_date >= v_start
      AND p.payment_date <= v_end
      AND p.status = 'completed'
  ),
  expense_data AS (
    SELECT 
      COALESCE(category, 'Other') AS category,
      COALESCE(SUM(amount), 0)::numeric AS amount
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND e.expense_date >= v_start
      AND e.expense_date <= v_end
    GROUP BY category
  ),
  totals AS (
    SELECT 
      (SELECT amount FROM income_data) AS total_income,
      COALESCE((SELECT SUM(amount) FROM expense_data), 0)::numeric AS total_expenses
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'gross_income', (SELECT total_income FROM totals),
      'total_expenses', (SELECT total_expenses FROM totals),
      'net_income', (SELECT total_income FROM totals) - (SELECT total_expenses FROM totals),
      'expense_ratio', CASE 
        WHEN (SELECT total_income FROM totals) > 0 
        THEN ROUND(((SELECT total_expenses FROM totals) / (SELECT total_income FROM totals)) * 100, 1)
        ELSE 0 
      END
    ),
    'charts', jsonb_build_object(
      'income_breakdown', jsonb_build_array(
        jsonb_build_object('name', 'Rental Income', 'value', (SELECT total_income FROM totals))
      ),
      'expense_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', category, 'value', amount))
        FROM expense_data
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'amount', amount,
        'type', 'Expense'
      ))
      FROM expense_data
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$