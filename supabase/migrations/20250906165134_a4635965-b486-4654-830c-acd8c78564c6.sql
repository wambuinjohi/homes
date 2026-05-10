-- Update get_executive_summary_report to handle tenant scope and provide better fallbacks
CREATE OR REPLACE FUNCTION public.get_executive_summary_report(
  p_start_date date DEFAULT NULL::date, 
  p_end_date date DEFAULT NULL::date,
  p_include_tenant_scope boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('month', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_tenant boolean := false;
BEGIN
  -- Check user role
  SELECT has_role(v_user_id, 'Admin'::public.app_role) INTO v_is_admin;
  SELECT is_user_tenant(v_user_id) INTO v_is_tenant;
  
  -- Revenue calculation with proper scope handling
  WITH revenue_data AS (
    SELECT 
      COALESCE(SUM(pay.amount), 0)::numeric AS total_revenue,
      COUNT(pay.id)::int AS payment_count
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status IN ('completed', 'paid', 'success')
      AND (
        v_is_admin 
        OR (p.owner_id = v_user_id OR p.manager_id = v_user_id)
        OR (v_is_tenant AND p_include_tenant_scope AND pay.tenant_id IN (
          SELECT t.id FROM public.tenants t WHERE t.user_id = v_user_id
        ))
      )
  ),
  expense_data AS (
    SELECT 
      COALESCE(SUM(e.amount), 0)::numeric AS total_expenses,
      COUNT(e.id)::int AS expense_count
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (
        v_is_admin 
        OR (p.owner_id = v_user_id OR p.manager_id = v_user_id)
        OR (v_is_tenant AND p_include_tenant_scope AND e.tenant_id IN (
          SELECT t.id FROM public.tenants t WHERE t.user_id = v_user_id
        ))
      )
  ),
  outstanding_data AS (
    SELECT 
      COALESCE(SUM(
        GREATEST(inv.amount - COALESCE(paid.total_paid, 0), 0)
      ), 0)::numeric AS total_outstanding
    FROM public.invoices inv
    JOIN public.leases l ON inv.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN (
      SELECT 
        invoice_id,
        SUM(amount) AS total_paid
      FROM public.payments 
      WHERE status IN ('completed', 'paid', 'success')
      GROUP BY invoice_id
    ) paid ON paid.invoice_id = inv.id
    WHERE (
      v_is_admin 
      OR (p.owner_id = v_user_id OR p.manager_id = v_user_id)
      OR (v_is_tenant AND p_include_tenant_scope AND inv.tenant_id IN (
        SELECT t.id FROM public.tenants t WHERE t.user_id = v_user_id
      ))
    )
  ),
  occupancy_data AS (
    SELECT 
      COUNT(DISTINCT u.id)::int AS total_units,
      COUNT(DISTINCT CASE 
        WHEN l.lease_start_date <= v_end 
        AND l.lease_end_date >= v_start 
        AND COALESCE(l.status, 'active') <> 'terminated' 
        THEN u.id 
      END)::int AS occupied_units
    FROM public.units u
    JOIN public.properties p ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    WHERE (
      v_is_admin 
      OR (p.owner_id = v_user_id OR p.manager_id = v_user_id)
      OR (v_is_tenant AND p_include_tenant_scope AND u.id IN (
        SELECT DISTINCT l2.unit_id FROM public.leases l2 WHERE l2.tenant_id IN (
          SELECT t.id FROM public.tenants t WHERE t.user_id = v_user_id
        )
      ))
    )
  ),
  kpis AS (
    SELECT
      rd.total_revenue,
      ed.total_expenses,
      (rd.total_revenue - ed.total_expenses) AS net_operating_income,
      od.total_outstanding,
      CASE 
        WHEN od2.total_units > 0 THEN 
          ROUND((od2.occupied_units::numeric / od2.total_units::numeric) * 100, 1)
        ELSE 0 
      END AS occupancy_rate,
      CASE 
        WHEN (rd.total_revenue + od.total_outstanding) > 0 THEN
          ROUND((rd.total_revenue::numeric / (rd.total_revenue + od.total_outstanding)) * 100, 1)
        ELSE 0
      END AS collection_rate
    FROM revenue_data rd, expense_data ed, outstanding_data od, occupancy_data od2
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT total_revenue FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_operating_income', (SELECT net_operating_income FROM kpis),
      'total_outstanding', (SELECT total_outstanding FROM kpis),
      'occupancy_rate', (SELECT occupancy_rate FROM kpis),
      'collection_rate', (SELECT collection_rate FROM kpis)
    ),
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end,
      'period_type', CASE 
        WHEN v_start = date_trunc('month', now())::date THEN 'current_month'
        WHEN v_start = date_trunc('year', now())::date THEN 'current_year'
        ELSE 'custom'
      END
    ),
    'metadata', jsonb_build_object(
      'user_role', CASE 
        WHEN v_is_admin THEN 'admin'
        WHEN v_is_tenant THEN 'tenant'
        ELSE 'landlord'
      END,
      'generated_at', now()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;