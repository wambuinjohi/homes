
-- 1) Occupancy Report
CREATE OR REPLACE FUNCTION public.get_occupancy_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('month', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_total_units integer := 0;
  v_result jsonb;
BEGIN
  -- Total units in portfolio
  SELECT COALESCE(COUNT(u.id), 0)
  INTO v_total_units
  FROM public.units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid());

  WITH occupied_units AS (
    SELECT DISTINCT u.id, u.property_id
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    JOIN public.leases l ON l.unit_id = u.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND l.lease_start_date <= v_end
      AND l.lease_end_date >= v_start
      AND COALESCE(l.status, 'active') <> 'terminated'
  ),
  occupied_count AS (
    SELECT COUNT(*)::int AS occupied_units
    FROM occupied_units
  ),
  property_stats AS (
    SELECT 
      pr.id AS property_id,
      pr.name AS property_name,
      COUNT(u.id)::int AS total_units,
      COALESCE(SUM(CASE WHEN ou.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS occupied_units
    FROM public.properties pr
    JOIN public.units u ON u.property_id = pr.id
    LEFT JOIN occupied_units ou ON ou.id = u.id
    WHERE (pr.owner_id = auth.uid() OR pr.manager_id = auth.uid())
    GROUP BY pr.id, pr.name
  ),
  occupancy_trend AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      CASE 
        WHEN v_total_units > 0 THEN
          ROUND(
            (
              SELECT COUNT(DISTINCT u2.id)::numeric
              FROM public.units u2
              JOIN public.properties p2 ON p2.id = u2.property_id
              JOIN public.leases l2 ON l2.unit_id = u2.id
              WHERE (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid())
                AND l2.lease_start_date <= (date_trunc('month', d) + interval '1 month' - interval '1 day')
                AND l2.lease_end_date >= date_trunc('month', d)
                AND COALESCE(l2.status, 'active') <> 'terminated'
            ) / v_total_units::numeric * 100, 1
          )
        ELSE 0
      END AS occupancy_rate
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  per_property AS (
    SELECT
      property_name AS property,
      occupied_units AS occupied,
      (total_units - occupied_units) AS vacant
    FROM property_stats
  ),
  table_rows AS (
    SELECT 
      property_name,
      total_units,
      occupied_units,
      CASE WHEN total_units > 0 THEN ROUND((occupied_units::numeric / total_units::numeric) * 100, 1) ELSE 0 END AS occupancy_rate
    FROM property_stats
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'occupancy_rate', CASE WHEN v_total_units > 0 THEN ROUND(((SELECT occupied_units FROM occupied_count)::numeric / v_total_units::numeric) * 100, 1) ELSE 0 END,
      'total_units', v_total_units,
      'occupied_units', COALESCE((SELECT occupied_units FROM occupied_count), 0),
      'vacant_units', GREATEST(v_total_units - COALESCE((SELECT occupied_units FROM occupied_count), 0), 0)
    ),
    'charts', jsonb_build_object(
      'occupancy_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'occupancy_rate', occupancy_rate
        ))
        FROM occupancy_trend
      ), '[]'::jsonb),
      'property_occupancy', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property', property,
          'occupied', occupied,
          'vacant', vacant
        ))
        FROM per_property
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'total_units', total_units,
        'occupied_units', occupied_units,
        'occupancy_rate', occupancy_rate
      ) ORDER BY property_name)
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2) Maintenance Report
CREATE OR REPLACE FUNCTION public.get_maintenance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, (now() - interval '6 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH relevant AS (
    SELECT 
      mr.*,
      pr.name AS property_name
    FROM public.maintenance_requests mr
    JOIN public.properties pr ON pr.id = mr.property_id
    WHERE (pr.owner_id = auth.uid() OR pr.manager_id = auth.uid())
      AND mr.submitted_date::date >= v_start
      AND mr.submitted_date::date <= v_end
  ),
  kpis AS (
    SELECT
      COUNT(*)::int AS total_requests,
      SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END)::int AS completed_requests,
      ROUND(AVG(
        CASE 
          WHEN completed_date IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_date - submitted_date)) / 86400
          ELSE NULL
        END
      )::numeric, 1) AS avg_resolution_days,
      COALESCE(SUM(cost), 0)::numeric AS total_cost
    FROM relevant
  ),
  requests_by_status AS (
    SELECT COALESCE(NULLIF(status,''), 'unknown')::text AS name, COUNT(*)::int AS value
    FROM relevant
    GROUP BY 1
  ),
  monthly_requests AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT COUNT(*) FROM relevant r
        WHERE r.submitted_date >= date_trunc('month', d)
          AND r.submitted_date < (date_trunc('month', d) + interval '1 month')
      ), 0)::int AS requests
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  table_rows AS (
    SELECT 
      property_name,
      category,
      status,
      submitted_date::date AS created_date,
      COALESCE(cost, 0)::numeric AS cost
    FROM relevant
    ORDER BY submitted_date DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_requests', (SELECT total_requests FROM kpis),
      'completed_requests', (SELECT completed_requests FROM kpis),
      'avg_resolution_time', (SELECT COALESCE(avg_resolution_days, 0) FROM kpis),
      'total_cost', (SELECT total_cost FROM kpis)
    ),
    'charts', jsonb_build_object(
      'requests_by_status', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value))
        FROM requests_by_status
      ), '[]'::jsonb),
      'monthly_requests', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'requests', requests))
        FROM monthly_requests
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'category', category,
        'status', status,
        'created_date', created_date,
        'cost', cost
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 3) Expense Summary
CREATE OR REPLACE FUNCTION public.get_expense_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
  WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid());

  WITH relevant AS (
    SELECT 
      e.*,
      p.name AS property_name
    FROM public.expenses e
    JOIN public.properties p ON p.id = e.property_id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
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
$$;

-- 4) Lease Expiry Report
CREATE OR REPLACE FUNCTION public.get_lease_expiry_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, now()::date);
  v_end   date := COALESCE(p_end_date, (now() + interval '90 days')::date);
  v_result jsonb;
BEGIN
  WITH relevant AS (
    SELECT 
      l.*,
      u.unit_number,
      p.name AS property_name,
      t.first_name,
      t.last_name
    FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.properties p ON p.id = u.property_id
    LEFT JOIN public.tenants t ON t.id = l.tenant_id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
      AND l.lease_end_date BETWEEN v_start AND v_end
  ),
  kpis AS (
    SELECT
      COUNT(*)::int AS expiring_leases,
      0::numeric AS renewal_rate, -- Placeholder (requires explicit renewal tracking)
      ROUND(AVG(EXTRACT(EPOCH FROM (lease_end_date - lease_start_date)) / 86400)::numeric, 1) AS avg_lease_duration_days,
      COALESCE(SUM(monthly_rent), 0)::numeric AS potential_revenue_loss
    FROM relevant
  ),
  expiry_timeline AS (
    SELECT 
      to_char(date_trunc('month', lease_end_date), 'Mon') AS month,
      COUNT(*)::int AS expiring
    FROM relevant
    GROUP BY 1
    ORDER BY MIN(date_trunc('month', lease_end_date))
  ),
  table_rows AS (
    SELECT 
      property_name,
      unit_number,
      (COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))::text AS tenant_name,
      lease_end_date,
      monthly_rent,
      GREATEST((lease_end_date - current_date), 0)::int AS days_until_expiry
    FROM relevant
    ORDER BY lease_end_date
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'expiring_leases', (SELECT expiring_leases FROM kpis),
      'renewal_rate', (SELECT renewal_rate FROM kpis),
      'potential_revenue_loss', (SELECT potential_revenue_loss FROM kpis),
      'avg_lease_duration', (SELECT COALESCE(avg_lease_duration_days, 0) FROM kpis)
    ),
    'charts', jsonb_build_object(
      'expiry_timeline', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'expiring', expiring))
        FROM expiry_timeline
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'tenant_name', tenant_name,
        'lease_end_date', lease_end_date,
        'monthly_rent', monthly_rent,
        'days_until_expiry', days_until_expiry
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 5) Outstanding Balances
CREATE OR REPLACE FUNCTION public.get_outstanding_balances_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, now()::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH relevant_invoices AS (
    SELECT 
      inv.*,
      u.id AS unit_id,
      u.unit_number,
      p.id AS property_id,
      p.name AS property_name,
      t.id AS tenant_id,
      t.first_name,
      t.last_name,
      t.email
    FROM public.invoices inv
    JOIN public.leases l ON inv.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.tenants t ON inv.tenant_id = t.id
    WHERE inv.invoice_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ),
  payments_by_invoice AS (
    SELECT 
      invoice_id, 
      COALESCE(SUM(amount), 0)::numeric AS amount_paid
    FROM public.payments
    WHERE status = 'completed'
      AND payment_date <= v_end
      AND invoice_id IS NOT NULL
    GROUP BY invoice_id
  ),
  with_outstanding AS (
    SELECT 
      ri.*,
      COALESCE(pbi.amount_paid, 0)::numeric AS amount_paid_total,
      GREATEST((ri.amount - COALESCE(pbi.amount_paid, 0))::numeric, 0)::numeric AS outstanding_amount,
      GREATEST((v_end - ri.due_date), 0)::int AS days_overdue
    FROM relevant_invoices ri
    LEFT JOIN payments_by_invoice pbi ON pbi.invoice_id = ri.id
  ),
  outstanding_only AS (
    SELECT * FROM with_outstanding WHERE outstanding_amount > 0
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(outstanding_amount), 0)::numeric AS total_outstanding,
      COUNT(*)::int AS invoice_count,
      ROUND(AVG(outstanding_amount)::numeric, 2) AS avg_balance,
      COALESCE(SUM(CASE WHEN days_overdue > 30 THEN outstanding_amount ELSE 0 END), 0)::numeric AS at_risk_amount,
      COALESCE(SUM(CASE WHEN days_overdue > 0 THEN 1 ELSE 0 END), 0)::int AS overdue_count
    FROM outstanding_only
  ),
  aging AS (
    SELECT 
      CASE 
        WHEN days_overdue <= 30 THEN '0-30'
        WHEN days_overdue <= 60 THEN '31-60'
        WHEN days_overdue <= 90 THEN '61-90'
        ELSE '90+'
      END AS aging_bucket,
      SUM(outstanding_amount)::numeric AS amount
    FROM outstanding_only
    GROUP BY 1
    ORDER BY MIN(days_overdue)
  ),
  risk_breakdown AS (
    SELECT 
      CASE 
        WHEN days_overdue = 0 THEN 'Low'
        WHEN days_overdue <= 30 THEN 'Low'
        WHEN days_overdue <= 60 THEN 'Medium'
        WHEN days_overdue <= 90 THEN 'High'
        ELSE 'Critical'
      END AS name,
      COUNT(*)::int AS value
    FROM outstanding_only
    GROUP BY 1
    ORDER BY 1
  ),
  table_rows AS (
    SELECT 
      (COALESCE(first_name, '') || ' ' || COALESCE(last_name,''))::text AS tenant_name,
      property_name,
      outstanding_amount,
      days_overdue,
      CASE 
        WHEN days_overdue = 0 THEN 'Low'
        WHEN days_overdue <= 30 THEN 'Low'
        WHEN days_overdue <= 60 THEN 'Medium'
        WHEN days_overdue <= 90 THEN 'High'
        ELSE 'Critical'
      END AS risk_level
    FROM outstanding_only
    ORDER BY outstanding_amount DESC
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_outstanding', (SELECT total_outstanding FROM kpis),
      'overdue_count', (SELECT overdue_count FROM kpis),
      'avg_balance', (SELECT avg_balance FROM kpis),
      'at_risk_amount', (SELECT at_risk_amount FROM kpis)
    ),
    'charts', jsonb_build_object(
      'aging_analysis', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('aging_bucket', aging_bucket, 'amount', amount))
        FROM aging
      ), '[]'::jsonb),
      'risk_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value))
        FROM risk_breakdown
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tenant_name', tenant_name,
        'property_name', property_name,
        'outstanding_amount', outstanding_amount,
        'days_overdue', days_overdue,
        'risk_level', risk_level
      ))
      FROM table_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
