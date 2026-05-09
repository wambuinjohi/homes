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
$function$;

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
$function$;