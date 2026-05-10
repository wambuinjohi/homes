-- Drop and recreate Financial Summary report function
DROP FUNCTION IF EXISTS public.get_financial_summary_report(date, date);

CREATE OR REPLACE FUNCTION public.get_financial_summary_report(
  p_start_date DATE,
  p_end_date DATE
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_start DATE := p_start_date;
  v_end DATE := p_end_date;
  v_total_income numeric := 0;
  v_total_expenses numeric := 0;
  v_net_profit numeric := 0;
  v_profit_margin numeric := 0;
  v_table_data jsonb;
  result jsonb;
BEGIN
  -- Get total income from payments
  SELECT COALESCE(SUM(pay.amount), 0)
  INTO v_total_income
  FROM public.payments pay
  JOIN public.leases l ON pay.lease_id = l.id
  JOIN public.units u ON l.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  WHERE pay.payment_date >= v_start
    AND pay.payment_date <= v_end
    AND pay.status = 'completed'
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid());

  -- Get total expenses
  SELECT COALESCE(SUM(exp.amount), 0)
  INTO v_total_expenses
  FROM public.expenses exp
  JOIN public.properties p ON exp.property_id = p.id
  WHERE exp.expense_date >= v_start
    AND exp.expense_date <= v_end
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid());

  -- Calculate net profit and margin
  v_net_profit := v_total_income - v_total_expenses;
  v_profit_margin := CASE 
    WHEN v_total_income > 0 
    THEN ROUND((v_net_profit / v_total_income) * 100, 2)
    ELSE 0 
  END;

  -- Get expense breakdown for table
  WITH expense_breakdown AS (
    SELECT 
      COALESCE(exp.category, 'Other') as category,
      SUM(exp.amount) as amount
    FROM public.expenses exp
    JOIN public.properties p ON exp.property_id = p.id
    WHERE exp.expense_date >= v_start
      AND exp.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    GROUP BY COALESCE(exp.category, 'Other')
    
    UNION ALL
    
    SELECT 
      'Income' as category,
      v_total_income as amount
    WHERE v_total_income > 0
  ),
  total_amount AS (
    SELECT SUM(amount) as total FROM expense_breakdown
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'category', category,
      'amount', amount,
      'percentage', CASE 
        WHEN (SELECT total FROM total_amount) > 0 
        THEN ROUND((amount / (SELECT total FROM total_amount)) * 100, 1)
        ELSE 0 
      END
    )
  ), '[]'::jsonb)
  INTO v_table_data
  FROM expense_breakdown
  WHERE amount > 0
  ORDER BY amount DESC;

  -- Build final result
  result := jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_income', v_total_income,
      'total_expenses', v_total_expenses,
      'net_profit', v_net_profit,
      'profit_margin', v_profit_margin
    ),
    'charts', jsonb_build_object(
      'income_vs_expenses', jsonb_build_array(
        jsonb_build_object('name', 'Income', 'value', v_total_income, 'color', '#10b981'),
        jsonb_build_object('name', 'Expenses', 'value', v_total_expenses, 'color', '#ef4444')
      ),
      'expense_breakdown', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name', category, 
            'value', amount,
            'color', CASE category
              WHEN 'Maintenance' THEN '#3b82f6'
              WHEN 'Utilities' THEN '#8b5cf6'
              WHEN 'Insurance' THEN '#f59e0b'
              WHEN 'Property Management' THEN '#ef4444'
              WHEN 'Marketing' THEN '#06b6d4'
              ELSE '#6b7280'
            END
          )
        ), '[]'::jsonb)
        FROM (
          SELECT 
            COALESCE(exp.category, 'Other') as category,
            SUM(exp.amount) as amount
          FROM public.expenses exp
          JOIN public.properties p ON exp.property_id = p.id
          WHERE exp.expense_date >= v_start
            AND exp.expense_date <= v_end
            AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          GROUP BY COALESCE(exp.category, 'Other')
          HAVING SUM(exp.amount) > 0
          ORDER BY SUM(exp.amount) DESC
        ) expense_data
      )
    ),
    'table', v_table_data
  );

  RETURN result;
END;
$$;