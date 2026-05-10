
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
  v_result jsonb;
BEGIN
  -- Count total units across accessible properties
  SELECT COALESCE(COUNT(u.id), 0)
  INTO v_total_units
  FROM public.units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role));

  WITH relevant AS (
    SELECT 
      e.id,
      e.property_id,
      e.unit_id,
      e.amount::numeric AS amount,
      e.expense_date,
      COALESCE(NULLIF(e.category, ''), 'Uncategorized')::text AS category,
      p.name AS property_name
    FROM public.expenses e
    JOIN public.properties p ON p.id = e.property_id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  totals AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
    FROM relevant
  ),
  maintenance_sum AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS maintenance_costs
    FROM relevant
    WHERE lower(category) IN (
      'maintenance','repair','repairs','service','plumbing','electrical','landscaping','hvac'
    )
  ),
  operational_sum AS (
    SELECT (SELECT total_expenses FROM totals) - (SELECT maintenance_costs FROM maintenance_sum) AS operational_costs
  ),
  monthly_expenses AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(r.amount)::numeric
        FROM relevant r
        WHERE r.expense_date >= date_trunc('month', d)
          AND r.expense_date < (date_trunc('month', d) + interval '1 month')
      ), 0) AS expenses
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  by_category AS (
    SELECT 
      category,
      SUM(amount)::numeric AS amount,
      COUNT(*)::int AS count
    FROM relevant
    GROUP BY category
    ORDER BY amount DESC
  ),
  expense_categories AS (
    SELECT category AS name, amount AS value
    FROM by_category
  ),
  table_rows AS (
    SELECT 
      category,
      amount,
      CASE 
        WHEN (SELECT total_expenses FROM totals) > 0 
        THEN ROUND((amount / (SELECT total_expenses FROM totals)) * 100, 1)
        ELSE 0
      END AS percentage,
      count
    FROM by_category
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_expenses', (SELECT total_expenses FROM totals),
      'maintenance_costs', (SELECT maintenance_costs FROM maintenance_sum),
      'operational_costs', (SELECT operational_costs FROM operational_sum),
      'expense_per_unit', CASE 
        WHEN v_total_units > 0 THEN ROUND(((SELECT total_expenses FROM totals) / v_total_units)::numeric, 2)
        ELSE 0
      END
    ),
    'charts', jsonb_build_object(
      'expense_categories', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value))
        FROM expense_categories
      ), '[]'::jsonb),
      'monthly_expenses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('month', month, 'expenses', expenses))
        FROM monthly_expenses
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
