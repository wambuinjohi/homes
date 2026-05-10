-- Update Executive Summary Report function
CREATE OR REPLACE FUNCTION public.get_executive_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH revenue_data AS (
    SELECT 
      COALESCE(SUM(pay.amount), 0)::numeric AS total_collected
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status IN ('completed', 'paid', 'success')
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  invoice_data AS (
    SELECT 
      COALESCE(SUM(inv.amount), 0)::numeric AS total_invoiced
    FROM public.invoices inv
    JOIN public.leases l ON inv.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE inv.invoice_date >= v_start
      AND inv.invoice_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  expense_data AS (
    SELECT 
      COALESCE(SUM(e.amount), 0)::numeric AS total_expenses
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  outstanding_data AS (
    SELECT 
      COALESCE(SUM(GREATEST(inv.amount - COALESCE(payments.amount_paid, 0), 0)), 0)::numeric AS total_outstanding
    FROM public.invoices inv
    JOIN public.leases l ON inv.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN (
      SELECT 
        invoice_id, 
        SUM(amount) AS amount_paid
      FROM public.payments
      WHERE status = 'completed'
      GROUP BY invoice_id
    ) payments ON payments.invoice_id = inv.id
    WHERE inv.due_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  property_summary AS (
    SELECT 
      p.name AS property_name,
      COUNT(u.id)::int AS units,
      COALESCE(SUM(CASE WHEN pay.status IN ('completed', 'paid', 'success') THEN pay.amount ELSE 0 END), 0)::numeric AS revenue,
      CASE 
        WHEN COUNT(u.id) > 0 THEN
          ROUND(
            (COUNT(CASE WHEN l.id IS NOT NULL AND l.lease_end_date >= v_end AND l.lease_start_date <= v_end THEN 1 END)::numeric / COUNT(u.id)::numeric) * 100, 
            1
          )
        ELSE 0
      END AS occupancy,
      v_end AS report_date
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    LEFT JOIN public.payments pay ON pay.lease_id = l.id 
      AND pay.payment_date >= v_start 
      AND pay.payment_date <= v_end
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
    GROUP BY p.id, p.name
  ),
  kpis AS (
    SELECT
      rd.total_collected AS total_revenue,
      ed.total_expenses,
      (rd.total_collected - ed.total_expenses) AS net_operating_income,
      od.total_outstanding,
      CASE 
        WHEN id.total_invoiced > 0 THEN 
          ROUND((rd.total_collected / id.total_invoiced) * 100, 1)
        ELSE 0 
      END AS collection_rate
    FROM revenue_data rd, expense_data ed, outstanding_data od, invoice_data id
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM kpis),
      'net_operating_income', (SELECT net_operating_income FROM kpis),
      'total_outstanding', (SELECT total_outstanding FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'collection_rate', (SELECT collection_rate FROM kpis)
    ),
    'charts', jsonb_build_object(),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'report_date', report_date,
        'property_name', property_name,
        'units', units,
        'revenue', revenue,
        'occupancy', occupancy
      ) ORDER BY property_name)
      FROM property_summary
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Update Cash Flow Analysis Report function
CREATE OR REPLACE FUNCTION public.get_cash_flow_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
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
  WITH monthly_cash_flow AS (
    SELECT 
      date_trunc('month', d)::date AS period_start,
      (date_trunc('month', d) + interval '1 month' - interval '1 day')::date AS period_end,
      to_char(date_trunc('month', d), 'Mon YYYY') AS month,
      COALESCE((
        SELECT SUM(pay.amount)
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status IN ('completed', 'paid', 'success')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0)::numeric AS inflow,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.properties p ON e.property_id = p.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0)::numeric AS outflow
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  with_net_flow AS (
    SELECT 
      *,
      (inflow - outflow) AS net_flow
    FROM monthly_cash_flow
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(inflow), 0)::numeric AS total_inflow,
      COALESCE(SUM(outflow), 0)::numeric AS total_outflow,
      COALESCE(SUM(net_flow), 0)::numeric AS net_cash_flow,
      CASE 
        WHEN SUM(outflow) > 0 THEN 
          ROUND((SUM(inflow) / SUM(outflow)) * 100, 1)
        ELSE 0 
      END AS cash_flow_ratio
    FROM with_net_flow
  ),
  trend_data AS (
    SELECT 
      month,
      inflow,
      outflow,
      net_flow
    FROM with_net_flow
    ORDER BY period_start
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_inflow', (SELECT total_inflow FROM kpis),
      'total_outflow', (SELECT total_outflow FROM kpis),
      'net_cash_flow', (SELECT net_cash_flow FROM kpis),
      'cash_flow_ratio', (SELECT cash_flow_ratio FROM kpis)
    ),
    'charts', jsonb_build_object(
      'cash_flow_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'inflow', inflow,
          'outflow', outflow,
          'net_flow', net_flow
        ))
        FROM trend_data
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period_end', period_end,
        'month', month,
        'inflow', inflow,
        'outflow', outflow,
        'net_flow', net_flow
      ) ORDER BY period_start)
      FROM with_net_flow
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;