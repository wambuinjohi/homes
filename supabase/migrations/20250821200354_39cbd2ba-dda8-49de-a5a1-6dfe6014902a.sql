
CREATE OR REPLACE FUNCTION public.get_outstanding_balances_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
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
$function$;
