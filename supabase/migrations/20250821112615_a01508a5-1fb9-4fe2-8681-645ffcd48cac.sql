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
    WHERE prop.owner_id = auth.uid() OR prop.manager_id = auth.uid()
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

-- Cash Flow Report
CREATE OR REPLACE FUNCTION public.get_cash_flow_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, (now() - interval '6 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH monthly_cash_flow AS (
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
      ), 0) AS cash_in,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          AND exp.expense_date >= date_trunc('month', d)
          AND exp.expense_date < (date_trunc('month', d) + interval '1 month')
      ), 0) AS cash_out
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  totals AS (
    SELECT 
      SUM(cash_in)::numeric AS total_cash_in,
      SUM(cash_out)::numeric AS total_cash_out
    FROM monthly_cash_flow
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_cash_in', (SELECT total_cash_in FROM totals),
      'total_cash_out', (SELECT total_cash_out FROM totals),
      'net_cash_flow', (SELECT total_cash_in FROM totals) - (SELECT total_cash_out FROM totals),
      'operating_margin', CASE 
        WHEN (SELECT total_cash_in FROM totals) > 0 
        THEN ROUND((((SELECT total_cash_in FROM totals) - (SELECT total_cash_out FROM totals)) / (SELECT total_cash_in FROM totals)) * 100, 1)
        ELSE 0 
      END
    ),
    'charts', jsonb_build_object(
      'monthly_cash_flow', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'cash_in', cash_in,
          'cash_out', cash_out,
          'net_flow', cash_in - cash_out
        ))
        FROM monthly_cash_flow
      ), '[]'::jsonb)
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$

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
$function$

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
$function$

-- Tenant Turnover Report
CREATE OR REPLACE FUNCTION public.get_tenant_turnover_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH lease_events AS (
    SELECT 
      p.name AS property_name,
      u.unit_number,
      t.first_name || ' ' || t.last_name AS tenant_name,
      l.lease_start_date,
      l.lease_end_date,
      CASE WHEN l.lease_end_date < current_date THEN 'Moved Out' ELSE 'Active' END AS status,
      CASE 
        WHEN l.lease_end_date < current_date 
        THEN EXTRACT(EPOCH FROM (l.lease_end_date - l.lease_start_date)) / 86400
        ELSE EXTRACT(EPOCH FROM (current_date - l.lease_start_date)) / 86400
      END AS tenure_days
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    JOIN public.tenants t ON l.tenant_id = t.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND l.lease_start_date >= v_start
  ),
  turnover_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'Moved Out')::int AS moved_out_count,
      COUNT(*) FILTER (WHERE status = 'Active')::int AS active_leases,
      ROUND(AVG(tenure_days) FILTER (WHERE status = 'Moved Out'), 1)::numeric AS avg_tenure_days,
      COUNT(DISTINCT property_name)::int AS properties_with_turnover
    FROM lease_events
  ),
  monthly_turnover AS (
    SELECT 
      to_char(date_trunc('month', lease_end_date), 'Mon') AS month,
      COUNT(*)::int AS moveouts
    FROM lease_events
    WHERE status = 'Moved Out'
      AND lease_end_date >= date_trunc('month', v_start)
      AND lease_end_date <= v_end
    GROUP BY date_trunc('month', lease_end_date)
    ORDER BY date_trunc('month', lease_end_date)
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_turnover', (SELECT moved_out_count FROM turnover_stats),
      'active_leases', (SELECT active_leases FROM turnover_stats),
      'avg_tenure_days', COALESCE((SELECT avg_tenure_days FROM turnover_stats), 0),
      'turnover_rate', CASE 
        WHEN (SELECT active_leases + moved_out_count FROM turnover_stats) > 0 
        THEN ROUND(((SELECT moved_out_count FROM turnover_stats)::numeric / (SELECT active_leases + moved_out_count FROM turnover_stats)::numeric) * 100, 1)
        ELSE 0 
      END
    ),
    'charts', jsonb_build_object(
      'monthly_turnover', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'moveouts', moveouts))
        FROM monthly_turnover
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'tenant_name', tenant_name,
        'lease_start_date', lease_start_date,
        'lease_end_date', lease_end_date,
        'status', status,
        'tenure_days', tenure_days
      ))
      FROM lease_events
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$

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
      COUNT(DISTINCT CASE WHEN l.lease_end_date >= current_date AND l.status = 'active' THEN l.id END)::int AS occupied_units,
      COUNT(DISTINCT CASE WHEN mr.status = 'pending' THEN mr.id END)::int AS open_maintenance_requests
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    LEFT JOIN public.maintenance_requests mr ON mr.property_id = p.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ),
  financial_summary AS (
    SELECT 
      COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue,
      COALESCE(SUM(exp.amount), 0)::numeric AS total_expenses,
      COUNT(DISTINCT CASE WHEN inv.due_date < current_date AND inv.status != 'paid' THEN inv.id END)::int AS overdue_invoices
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    LEFT JOIN public.payments pay ON pay.lease_id = l.id 
      AND pay.payment_date >= v_start 
      AND pay.payment_date <= v_end 
      AND pay.status = 'completed'
    LEFT JOIN public.expenses exp ON exp.property_id = p.id 
      AND exp.expense_date >= v_start 
      AND exp.expense_date <= v_end
    LEFT JOIN public.invoices inv ON inv.lease_id = l.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ),
  key_metrics AS (
    SELECT 
      po.total_properties,
      po.total_units,
      po.occupied_units,
      po.open_maintenance_requests,
      fs.total_revenue,
      fs.total_expenses,
      fs.overdue_invoices,
      CASE WHEN po.total_units > 0 
        THEN ROUND((po.occupied_units::numeric / po.total_units::numeric) * 100, 1)
        ELSE 0 
      END AS occupancy_rate,
      fs.total_revenue - fs.total_expenses AS net_profit
    FROM portfolio_overview po, financial_summary fs
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_properties', (SELECT total_properties FROM key_metrics),
      'occupancy_rate', (SELECT occupancy_rate FROM key_metrics),
      'net_profit', (SELECT net_profit FROM key_metrics),
      'overdue_invoices', (SELECT overdue_invoices FROM key_metrics)
    ),
    'charts', jsonb_build_object(
      'portfolio_overview', jsonb_build_array(
        jsonb_build_object('name', 'Properties', 'value', (SELECT total_properties FROM key_metrics)),
        jsonb_build_object('name', 'Total Units', 'value', (SELECT total_units FROM key_metrics)),
        jsonb_build_object('name', 'Occupied Units', 'value', (SELECT occupied_units FROM key_metrics))
      )
    ),
    'table', jsonb_build_array(
      jsonb_build_object(
        'metric', 'Portfolio Size',
        'value', (SELECT total_properties || ' properties, ' || total_units || ' units' FROM key_metrics)
      ),
      jsonb_build_object(
        'metric', 'Occupancy Rate',
        'value', (SELECT occupancy_rate || '%' FROM key_metrics)
      ),
      jsonb_build_object(
        'metric', 'Revenue (Period)',
        'value', (SELECT total_revenue FROM key_metrics)
      ),
      jsonb_build_object(
        'metric', 'Net Profit (Period)',
        'value', (SELECT net_profit FROM key_metrics)
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$