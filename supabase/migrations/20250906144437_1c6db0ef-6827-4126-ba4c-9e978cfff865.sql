-- Fix get_financial_summary_report function with proper casting and relaxed payment status filters
CREATE OR REPLACE FUNCTION public.get_financial_summary_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_property_id uuid DEFAULT NULL::uuid)
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
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND (p_property_id IS NULL OR p.id = p_property_id)
  ),
  expense_data AS (
    SELECT 
      COALESCE(SUM(e.amount), 0)::numeric AS total_expenses,
      COUNT(e.id)::int AS expense_count
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND (p_property_id IS NULL OR p.id = p_property_id)
  ),
  monthly_trend AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
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
          AND (p_property_id IS NULL OR p.id = p_property_id)
      ), 0)::numeric AS revenue,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN public.properties p ON e.property_id = p.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
          AND (p_property_id IS NULL OR p.id = p_property_id)
      ), 0)::numeric AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  top_revenue_sources AS (
    SELECT 
      p.name AS property_name,
      SUM(pay.amount)::numeric AS amount,
      COUNT(pay.id)::int AS payment_count
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status IN ('completed', 'paid', 'success')
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND (p_property_id IS NULL OR p.id = p_property_id)
    GROUP BY p.id, p.name
    ORDER BY amount DESC
    LIMIT 10
  ),
  top_expense_categories AS (
    SELECT 
      e.category,
      SUM(e.amount)::numeric AS amount,
      COUNT(e.id)::int AS expense_count
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      AND (p_property_id IS NULL OR p.id = p_property_id)
    GROUP BY e.category
    ORDER BY amount DESC
    LIMIT 10
  ),
  kpis AS (
    SELECT
      rd.total_revenue AS total_income,
      ed.total_expenses,
      (rd.total_revenue - ed.total_expenses) AS net_income,
      CASE 
        WHEN ed.total_expenses > 0 THEN 
          ROUND(((rd.total_revenue - ed.total_expenses) / ed.total_expenses) * 100, 1)
        ELSE 0 
      END AS profit_margin,
      rd.payment_count,
      ed.expense_count
    FROM revenue_data rd, expense_data ed
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_income', (SELECT total_income FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_income', (SELECT net_income FROM kpis),
      'profit_margin', (SELECT profit_margin FROM kpis),
      'payment_count', (SELECT payment_count FROM kpis),
      'expense_count', (SELECT expense_count FROM kpis)
    ),
    'charts', jsonb_build_object(
      'monthly_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'revenue', revenue,
          'expenses', expenses,
          'net_income', (revenue - expenses)
        ))
        FROM monthly_trend
      ), '[]'::jsonb)
    ),
    'table', jsonb_build_object(
      'revenue_sources', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'property_name', property_name,
          'amount', amount,
          'payment_count', payment_count
        ))
        FROM top_revenue_sources
      ), '[]'::jsonb),
      'expense_categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'category', category,
          'amount', amount,
          'expense_count', expense_count
        ))
        FROM top_expense_categories
      ), '[]'::jsonb)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$