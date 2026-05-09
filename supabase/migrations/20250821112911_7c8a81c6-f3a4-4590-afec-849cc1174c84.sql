-- Cash Flow Report  
CREATE OR REPLACE FUNCTION public.get_cash_flow_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, (now() - interval '6 months')::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_result jsonb;
BEGIN
  WITH monthly_cash_flow AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(pay.amount)::numeric
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN public.properties p ON u.property_id = p.id
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          AND pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status = 'completed'
      ), 0) AS cash_in,
      COALESCE((
        SELECT SUM(exp.amount)::numeric
        FROM public.expenses exp
        JOIN public.properties p ON exp.property_id = p.id
        WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
          AND exp.expense_date >= date_trunc('month', d)
          AND exp.expense_date < (date_trunc('month', d) + interval '1 month')
      ), 0) AS cash_out
    FROM generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  totals AS (
    SELECT 
      SUM(cash_in)::numeric AS total_cash_in,
      SUM(cash_out)::numeric AS total_cash_out
    FROM monthly_cash_flow
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_cash_in', (SELECT total_cash_in FROM totals),
      'total_cash_out', (SELECT total_cash_out FROM totals),
      'net_cash_flow', (SELECT total_cash_in FROM totals) - (SELECT total_cash_out FROM totals),
      'operating_margin', CASE 
        WHEN (SELECT total_cash_in FROM totals) > 0 
        THEN ROUND((((SELECT total_cash_in FROM totals) - (SELECT total_cash_out FROM totals)) / (SELECT total_cash_in FROM totals)) * 100, 1)
        ELSE 0 
      END
    ),
    'charts', jsonb_build_object(
      'monthly_cash_flow', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'month', month,
          'cash_in', cash_in,
          'cash_out', cash_out,
          'net_flow', cash_in - cash_out
        ))
        FROM monthly_cash_flow
      ), '[]'::jsonb)
    ),
    'table', '[]'::jsonb
  ) INTO v_result;

  RETURN v_result;
END;
$function$