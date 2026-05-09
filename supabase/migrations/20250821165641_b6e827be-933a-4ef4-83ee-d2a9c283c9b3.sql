-- Create missing report functions with proper Admin scope and JSONB structure

-- 1. Profit & Loss Report
CREATE OR REPLACE FUNCTION public.get_profit_loss_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH revenue AS (
    SELECT COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status = 'completed'
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  ),
  expenses AS (
    SELECT COALESCE(SUM(exp.amount), 0)::numeric AS total_expenses
    FROM public.expenses exp
    JOIN public.properties p ON exp.property_id = p.id
    WHERE exp.expense_date >= v_start
      AND exp.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
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
        WHERE pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status = 'completed'
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS revenue,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE exp.expense_date >= date_trunc('month', d)
          AND exp.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
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
      'monthly_profit_loss', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'revenue', revenue,
          'expenses', expenses,
          'profit', revenue - expenses
        ))
        FROM monthly_data
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', month,
        'revenue', revenue,
        'expenses', expenses,
        'profit', revenue - expenses,
        'margin', CASE WHEN revenue > 0 THEN ROUND(((revenue - expenses) / revenue) * 100, 1) ELSE 0 END
      ))
      FROM monthly_data
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 2. Expense Summary Report  
CREATE OR REPLACE FUNCTION public.get_expense_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH totals AS (
    SELECT 
      COALESCE(SUM(exp.amount), 0)::numeric AS total_expenses,
      COUNT(*)::int AS expense_count,
      ROUND(AVG(exp.amount)::numeric, 2) AS avg_expense
    FROM public.expenses exp
    JOIN public.properties p ON exp.property_id = p.id
    WHERE exp.expense_date >= v_start
      AND exp.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  ),
  by_category AS (
    SELECT 
      exp.category,
      SUM(exp.amount)::numeric AS amount
    FROM public.expenses exp
    JOIN public.properties p ON exp.property_id = p.id
    WHERE exp.expense_date >= v_start
      AND exp.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
    GROUP BY exp.category
    ORDER BY amount DESC
  ),
  monthly_expenses AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE exp.expense_date >= date_trunc('month', d)
          AND exp.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  table_data AS (
    SELECT 
      p.name AS property_name,
      exp.category,
      exp.amount,
      exp.expense_date,
      exp.vendor_name,
      exp.description
    FROM public.expenses exp
    JOIN public.properties p ON exp.property_id = p.id
    WHERE exp.expense_date >= v_start
      AND exp.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
    ORDER BY exp.amount DESC
    LIMIT 50
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_expenses', (SELECT total_expenses FROM totals),
      'expense_count', (SELECT expense_count FROM totals),
      'avg_expense', (SELECT avg_expense FROM totals),
      'largest_category', (SELECT category FROM by_category LIMIT 1)
    ),
    'charts', jsonb_build_object(
      'expenses_by_category', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('category', category, 'amount', amount))
        FROM by_category
      ), '[]'::jsonb),
      'monthly_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'expenses', expenses))
        FROM monthly_expenses
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'category', category,
        'amount', amount,
        'expense_date', expense_date,
        'vendor_name', vendor_name,
        'description', description
      ))
      FROM table_data
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 3. Financial Summary Report
CREATE OR REPLACE FUNCTION public.get_financial_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH financials AS (
    SELECT 
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.payment_date >= v_start
          AND pay.payment_date <= v_end
          AND pay.status = 'completed'
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS total_revenue,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE exp.expense_date >= v_start
          AND exp.expense_date <= v_end
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS total_expenses,
      COALESCE((
        SELECT COUNT(DISTINCT u.id)::int
        FROM public.units u
        JOIN public.properties p ON u.property_id = p.id
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS total_properties
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', total_revenue,
      'total_expenses', total_expenses,
      'net_income', total_revenue - total_expenses,
      'total_properties', total_properties
    ),
    'charts', jsonb_build_object(
      'revenue_vs_expenses', jsonb_build_array(
        jsonb_build_object('name', 'Revenue', 'value', total_revenue),
        jsonb_build_object('name', 'Expenses', 'value', total_expenses)
      )
    ),
    'table', '[]'::jsonb
  ) INTO v_result
  FROM financials;

  RETURN v_result;
END;
$function$;

-- 4. Property Performance Report
CREATE OR REPLACE FUNCTION public.get_property_performance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH property_stats AS (
    SELECT 
      p.id,
      p.name AS property_name,
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        WHERE u.property_id = p.id
          AND pay.payment_date >= v_start
          AND pay.payment_date <= v_end
          AND pay.status = 'completed'
      ), 0) AS revenue,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        WHERE exp.property_id = p.id
          AND exp.expense_date >= v_start
          AND exp.expense_date <= v_end
      ), 0) AS expenses,
      COUNT(u.id)::int AS total_units,
      COALESCE((
        SELECT COUNT(DISTINCT l.id)::int
        FROM public.leases l
        JOIN public.units u2 ON l.unit_id = u2.id
        WHERE u2.property_id = p.id
          AND l.lease_start_date <= v_end
          AND l.lease_end_date >= v_start
          AND COALESCE(l.status, 'active') = 'active'
      ), 0) AS occupied_units
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
    GROUP BY p.id, p.name
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_properties', (SELECT COUNT(*) FROM property_stats),
      'total_revenue', (SELECT SUM(revenue) FROM property_stats),
      'total_expenses', (SELECT SUM(expenses) FROM property_stats),
      'avg_occupancy_rate', (
        SELECT CASE 
          WHEN SUM(total_units) > 0 
          THEN ROUND((SUM(occupied_units)::numeric / SUM(total_units)::numeric) * 100, 1)
          ELSE 0 
        END FROM property_stats
      )
    ),
    'charts', jsonb_build_object(
      'property_revenue', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('property', property_name, 'revenue', revenue))
        FROM property_stats
        ORDER BY revenue DESC
        LIMIT 10
      ), '[]'::jsonb),
      'property_profitability', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property_name, 
          'profit', revenue - expenses,
          'revenue', revenue,
          'expenses', expenses
        ))
        FROM property_stats
        ORDER BY (revenue - expenses) DESC
        LIMIT 10
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'revenue', revenue,
        'expenses', expenses,
        'profit', revenue - expenses,
        'total_units', total_units,
        'occupied_units', occupied_units,
        'occupancy_rate', CASE WHEN total_units > 0 THEN ROUND((occupied_units::numeric / total_units::numeric) * 100, 1) ELSE 0 END
      ) ORDER BY revenue DESC)
      FROM property_stats
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 5. Tenant Turnover Report
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
  WITH turnover_stats AS (
    SELECT 
      COUNT(DISTINCT l.id) FILTER (WHERE l.lease_end_date BETWEEN v_start AND v_end)::int AS leases_ended,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lease_start_date BETWEEN v_start AND v_end)::int AS new_leases,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lease_start_date <= v_end AND l.lease_end_date >= v_start)::int AS active_leases,
      ROUND(AVG(EXTRACT(EPOCH FROM (l.lease_end_date - l.lease_start_date)) / 86400)::numeric, 1) AS avg_lease_duration
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  ),
  monthly_turnover AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT COUNT(*)::int
        FROM public.leases l
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE l.lease_end_date >= date_trunc('month', d)
          AND l.lease_end_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS ended_leases,
      COALESCE((
        SELECT COUNT(*)::int
        FROM public.leases l
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE l.lease_start_date >= date_trunc('month', d)
          AND l.lease_start_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS new_leases
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'leases_ended', (SELECT leases_ended FROM turnover_stats),
      'new_leases', (SELECT new_leases FROM turnover_stats),
      'turnover_rate', CASE 
        WHEN (SELECT active_leases FROM turnover_stats) > 0
        THEN ROUND(((SELECT leases_ended FROM turnover_stats)::numeric / (SELECT active_leases FROM turnover_stats)::numeric) * 100, 1)
        ELSE 0 
      END,
      'avg_lease_duration', (SELECT avg_lease_duration FROM turnover_stats)
    ),
    'charts', jsonb_build_object(
      'monthly_turnover', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'ended_leases', ended_leases,
          'new_leases', new_leases
        ))
        FROM monthly_turnover
      ), '[]'::jsonb)
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 6. Executive Summary Report
CREATE OR REPLACE FUNCTION public.get_executive_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH summary_stats AS (
    SELECT 
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.payment_date >= v_start
          AND pay.payment_date <= v_end
          AND pay.status = 'completed'
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS total_revenue,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE exp.expense_date >= v_start
          AND exp.expense_date <= v_end
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS total_expenses,
      COALESCE((
        SELECT COUNT(DISTINCT p.id)::int
        FROM public.properties p
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS total_properties,
      COALESCE((
        SELECT COUNT(DISTINCT l.id)::int
        FROM public.leases l
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE l.lease_start_date <= v_end
          AND l.lease_end_date >= v_start
          AND COALESCE(l.status, 'active') = 'active'
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      ), 0) AS active_tenants
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', total_revenue,
      'total_expenses', total_expenses,
      'net_profit', total_revenue - total_expenses,
      'total_properties', total_properties,
      'active_tenants', active_tenants,
      'profit_margin', CASE 
        WHEN total_revenue > 0 
        THEN ROUND(((total_revenue - total_expenses) / total_revenue) * 100, 1)
        ELSE 0 
      END
    ),
    'charts', jsonb_build_object(
      'key_metrics', jsonb_build_array(
        jsonb_build_object('metric', 'Revenue', 'value', total_revenue),
        jsonb_build_object('metric', 'Expenses', 'value', total_expenses),
        jsonb_build_object('metric', 'Net Profit', 'value', total_revenue - total_expenses)
      )
    ),
    'table', '[]'::jsonb
  ) INTO v_result
  FROM summary_stats;

  RETURN v_result;
END;
$function$;

-- 7. Traceability functions for P&L underlying data
CREATE OR REPLACE FUNCTION public.get_pl_underlying_expenses(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', exp.id,
      'amount', exp.amount,
      'category', exp.category,
      'description', exp.description,
      'vendor_name', exp.vendor_name,
      'expense_date', exp.expense_date,
      'property_name', p.name,
      'created_by', COALESCE(prof.first_name || ' ' || prof.last_name, 'System')
    ) ORDER BY exp.amount DESC)
    FROM public.expenses exp
    JOIN public.properties p ON exp.property_id = p.id
    LEFT JOIN public.profiles prof ON exp.created_by = prof.id
    WHERE exp.expense_date >= p_start_date
      AND exp.expense_date <= p_end_date
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
    LIMIT 20
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pl_underlying_revenue(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', pay.id,
      'amount', pay.amount,
      'payment_date', pay.payment_date,
      'payment_method', pay.payment_method,
      'invoice_number', pay.invoice_number,
      'tenant_name', COALESCE(t.first_name || ' ' || t.last_name, 'Unknown'),
      'property_name', p.name,
      'status', pay.status
    ) ORDER BY pay.amount DESC)
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.tenants t ON pay.tenant_id = t.id
    WHERE pay.payment_date >= p_start_date
      AND pay.payment_date <= p_end_date
      AND pay.status = 'completed'
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
    LIMIT 20
  ), '[]'::jsonb);
END;
$function$;