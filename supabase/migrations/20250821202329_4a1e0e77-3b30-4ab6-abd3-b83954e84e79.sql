
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
  WITH monthly AS (
    SELECT
      date_trunc('month', d)::date AS month_date,
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE pay.status = 'completed'
          AND pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0) AS inflow,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE exp.expense_date >= date_trunc('month', d)
          AND exp.expense_date < (date_trunc('month', d) + interval '1 month')
          AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0) AS outflow
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  monthly_with_net AS (
    SELECT month_date, month, inflow, outflow, (inflow - outflow) AS net, (inflow - outflow) AS net_flow
    FROM monthly
  ),
  totals AS (
    SELECT SUM(inflow)::numeric AS total_in,
           SUM(outflow)::numeric AS total_out
    FROM monthly
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'cash_inflow', COALESCE((SELECT total_in FROM totals), 0),
      'cash_outflow', COALESCE((SELECT total_out FROM totals), 0),
      'net_cash_flow', COALESCE((SELECT total_in FROM totals), 0) - COALESCE((SELECT total_out FROM totals), 0),
      'cash_flow_margin', CASE 
        WHEN COALESCE((SELECT total_in FROM totals), 0) > 0
        THEN ROUND( (((SELECT total_in FROM totals) - (SELECT total_out FROM totals)) / (SELECT total_in FROM totals)) * 100, 1)
        ELSE 0
      END
    ),
    'charts', jsonb_build_object(
      'cash_flow_trend', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'inflow', inflow,
          'outflow', outflow,
          'net', net
        ) ORDER BY month_date)
        FROM monthly_with_net
      ), '[]'::jsonb),
      'cash_flow_breakdown', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'inflow', inflow,
          'outflow', outflow
        ) ORDER BY month_date)
        FROM monthly_with_net
      ), '[]'::jsonb)
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', month,
        'inflow', inflow,
        'outflow', outflow,
        'net_flow', net_flow
      ) ORDER BY month_date)
      FROM monthly_with_net
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
