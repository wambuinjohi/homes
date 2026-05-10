-- Update get_profit_loss_report to include Admin visibility
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
    WHERE (prop.owner_id = auth.uid() OR prop.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
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
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
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
$function$;

-- Update get_financial_summary_report to include Admin visibility
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
    WHERE (prop.owner_id = auth.uid() OR prop.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      AND p.payment_date >= v_start
      AND p.payment_date <= v_end
      AND p.status = 'completed'
  ),
  expenses AS (
    SELECT COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
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
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
          AND pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status = 'completed'
      ), 0) AS revenue,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
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
$function$;

-- Update get_expense_summary_report to include Admin visibility
CREATE OR REPLACE FUNCTION public.get_expense_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, (now() - interval '12 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_total_units integer := 0;
  v_total_expenses numeric := 0;
  v_result jsonb;
BEGIN
  -- Total units for expense-per-unit calculation
  SELECT COALESCE(COUNT(u.id), 0)
  INTO v_total_units
  FROM public.units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role));

  WITH relevant AS (
    SELECT 
      e.*,
      p.name AS property_name
    FROM public.expenses e
    JOIN public.properties p ON p.id = e.property_id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
      AND e.expense_date >= v_start
      AND e.expense_date <= v_end
  ),
  totals AS (
    SELECT 
      COALESCE(SUM(amount), 0)::numeric AS total_expenses,
      COALESCE(SUM(CASE WHEN LOWER(category) = 'maintenance' THEN amount ELSE 0 END), 0)::numeric AS maintenance_costs
    FROM relevant
  ),
  categories AS (
    SELECT 
      COALESCE(NULLIF(category,''), 'Uncategorized')::text AS name,
      COALESCE(SUM(amount), 0)::numeric AS value,
      COUNT(*)::int AS count
    FROM relevant
    GROUP BY 1
    ORDER BY value DESC
  ),
  monthly AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(amount)::numeric FROM relevant r
        WHERE r.expense_date >= date_trunc('month', d)
          AND r.expense_date < (date_trunc('month', d) + interval '1 month')
      ),0) AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  table_rows AS (
    SELECT 
      c.name AS category,
      c.value AS amount,
      CASE WHEN (SELECT total_expenses FROM totals) > 0 
        THEN ROUND((c.value / (SELECT total_expenses FROM totals)) * 100, 1)
        ELSE 0
      END AS percentage,
      c.count AS count
    FROM categories c
  )
  SELECT 
    (SELECT total_expenses FROM totals) INTO v_total_expenses;

  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_expenses', v_total_expenses,
      'maintenance_costs', (SELECT maintenance_costs FROM totals),
      'operational_costs', GREATEST(v_total_expenses - (SELECT maintenance_costs FROM totals), 0),
      'expense_per_unit', CASE WHEN v_total_units > 0 THEN ROUND((v_total_expenses / v_total_units)::numeric, 2) ELSE 0 END
    ),
    'charts', jsonb_build_object(
      'expense_categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value))
        FROM categories
      ), '[]'::jsonb),
      'monthly_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'expenses', expenses))
        FROM monthly
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'amount', amount,
        'percentage', percentage,
        'count', count
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Update get_rent_collection_report to include Admin visibility
CREATE OR REPLACE FUNCTION public.get_rent_collection_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_start date := coalesce(p_start_date, date_trunc('month', now())::date);
  v_end   date := coalesce(p_end_date, now()::date);
  v_result jsonb;
begin
  with
  relevant_invoices as (
    select 
      inv.*,
      u.id as unit_id,
      u.unit_number,
      p.id as property_id,
      p.name as property_name,
      t.id as tenant_id,
      t.first_name,
      t.last_name
    from public.invoices inv
    join public.leases l on inv.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    join public.tenants t on inv.tenant_id = t.id
    where inv.invoice_date >= v_start
      and inv.invoice_date <= v_end
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or has_role(auth.uid(), 'Admin'::app_role))
  ),
  payments_for_period as (
    select 
      pay.*
    from public.payments pay
    join public.leases l on pay.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    where pay.payment_date >= v_start
      and pay.payment_date <= v_end
      and pay.status = 'completed'
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or has_role(auth.uid(), 'Admin'::app_role))
  ),
  payments_by_invoice as (
    select 
      invoice_id, 
      coalesce(sum(amount), 0)::numeric as amount_paid
    from public.payments
    where status = 'completed'
      and payment_date <= v_end
      and invoice_id is not null
    group by invoice_id
  ),
  invoice_with_paid as (
    select 
      ri.*,
      coalesce(pbi.amount_paid, 0)::numeric as amount_paid_total
    from relevant_invoices ri
    left join payments_by_invoice pbi on pbi.invoice_id = ri.id
  ),
  kpis as (
    select
      -- Expected (due) is the sum of invoices in the period
      coalesce(sum(ri.amount), 0)::numeric as total_due,
      -- Collected is the sum of completed payments in the period
      (select coalesce(sum(amount), 0)::numeric from payments_for_period) as total_collected,
      -- Outstanding = due - collected (bounded at >= 0)
      greatest(
        coalesce(sum(ri.amount), 0)::numeric 
        - (select coalesce(sum(amount), 0)::numeric from payments_for_period),
        0
      )::numeric as outstanding_amount,
      -- Collection rate = collected / due * 100
      case 
        when coalesce(sum(ri.amount), 0) > 0 then
          round(((select coalesce(sum(amount), 0)::numeric from payments_for_period) / coalesce(sum(ri.amount), 0)::numeric) * 100, 1)
        else 0
      end as collection_rate,
      -- Late payments = invoices past due with not fully paid
      sum(
        case 
          when ri.due_date < current_date and coalesce(ri.status, 'pending') <> 'paid' 
          then 1 
          else 0 
        end
      )::integer as late_payments
    from relevant_invoices ri
  ),
  collection_trend as (
    select 
      to_char(date_trunc('month', d), 'Mon') as month,
      coalesce((
        select sum(pay.amount)::numeric
        from public.payments pay
        join public.leases l on pay.lease_id = l.id
        join public.units u on l.unit_id = u.id
        join public.properties p on u.property_id = p.id
        where pay.payment_date >= date_trunc('month', d)
          and pay.payment_date < (date_trunc('month', d) + interval '1 month')
          and pay.status = 'completed'
          and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or has_role(auth.uid(), 'Admin'::app_role))
      ), 0) as collected,
      coalesce((
        select sum(inv.amount)::numeric
        from public.invoices inv
        join public.leases l on inv.lease_id = l.id
        join public.units u on l.unit_id = u.id
        join public.properties p on u.property_id = p.id
        where inv.invoice_date >= date_trunc('month', d)
          and inv.invoice_date < (date_trunc('month', d) + interval '1 month')
          and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or has_role(auth.uid(), 'Admin'::app_role))
      ), 0) as expected
    from generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  payment_status as (
    select 'Paid'::text as name, count(*)::integer as value
    from invoice_with_paid
    where amount_paid_total >= amount
    union all
    select 'Partial', count(*) 
    from invoice_with_paid
    where amount_paid_total > 0 and amount_paid_total < amount
    union all
    select 'Overdue', count(*)
    from invoice_with_paid
    where amount_paid_total = 0 and due_date < current_date
  ),
  table_rows as (
    select 
      ri.property_name,
      ri.unit_number,
      (coalesce(ri.first_name, '') || ' ' || coalesce(ri.last_name, ''))::text as tenant_name,
      ri.amount::numeric as amount_due,
      coalesce(pbi.amount_paid, 0)::numeric as amount_paid,
      case 
        when coalesce(pbi.amount_paid, 0) >= ri.amount then 'Paid'
        when coalesce(pbi.amount_paid, 0) > 0 then 'Partial'
        when ri.due_date < current_date then 'Overdue'
        else coalesce(ri.status, 'pending')
      end as status
    from relevant_invoices ri
    left join payments_by_invoice pbi on pbi.invoice_id = ri.id
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_collected', (select total_collected from kpis),
      'collection_rate', (select collection_rate from kpis),
      'outstanding_amount', (select outstanding_amount from kpis),
      'late_payments', (select late_payments from kpis)
    ),
    'charts', jsonb_build_object(
      'collection_trend', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month', month,
          'collected', collected,
          'expected', expected
        )), '[]'::jsonb)
        from collection_trend
      ),
      'payment_status', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', name,
          'value', value
        )), '[]'::jsonb)
        from payment_status
      )
    ),
    'table', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'tenant_name', tenant_name,
        'amount_due', amount_due,
        'amount_paid', amount_paid,
        'status', status
      ) order by property_name, unit_number), '[]'::jsonb)
      from table_rows
    )
  ) into v_result;

  return v_result;
end;
$function$;