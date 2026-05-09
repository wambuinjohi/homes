-- Create comprehensive executive summary report function
CREATE OR REPLACE FUNCTION public.get_executive_summary_report(
  p_start_date date DEFAULT NULL::date, 
  p_end_date date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_start date := COALESCE(p_start_date, date_trunc('year', now())::date);
  v_end   date := COALESCE(p_end_date, now()::date);
  v_current_month_start date := date_trunc('month', now())::date;
  v_current_month_end date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_result jsonb;
BEGIN
  WITH user_properties AS (
    SELECT p.id, p.name
    FROM public.properties p
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  property_stats AS (
    SELECT
      COUNT(DISTINCT up.id)::int AS total_properties,
      COUNT(DISTINCT u.id)::int AS total_units,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM public.leases l 
          WHERE l.unit_id = u.id 
            AND l.lease_start_date <= now()::date
            AND l.lease_end_date >= now()::date
            AND COALESCE(l.status, 'active') <> 'terminated'
        ) THEN u.id 
      END)::int AS occupied_units
    FROM user_properties up
    LEFT JOIN public.units u ON u.property_id = up.id
  ),
  financial_data AS (
    SELECT 
      -- YTD Revenue
      COALESCE(SUM(
        CASE WHEN pay.payment_date >= v_start AND pay.payment_date <= v_end 
        THEN pay.amount ELSE 0 END
      ), 0)::numeric AS total_revenue,
      -- YTD Expenses  
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN user_properties up ON e.property_id = up.id
        WHERE e.expense_date >= v_start AND e.expense_date <= v_end
      ), 0)::numeric AS total_expenses,
      -- Current month collection rate calculation
      COALESCE(SUM(
        CASE WHEN pay.payment_date >= v_current_month_start AND pay.payment_date <= v_current_month_end 
        THEN pay.amount ELSE 0 END
      ), 0)::numeric AS current_month_payments
    FROM user_properties up
    LEFT JOIN public.units u ON u.property_id = up.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    LEFT JOIN public.payments pay ON pay.lease_id = l.id 
      AND pay.status IN ('completed', 'paid', 'success')
  ),
  current_month_invoices AS (
    SELECT COALESCE(SUM(inv.amount), 0)::numeric AS current_month_invoiced
    FROM user_properties up
    JOIN public.units u ON u.property_id = up.id
    JOIN public.leases l ON l.unit_id = u.id
    JOIN public.invoices inv ON inv.lease_id = l.id
    WHERE inv.invoice_date >= v_current_month_start 
      AND inv.invoice_date <= v_current_month_end
  ),
  outstanding_balances AS (
    SELECT COALESCE(SUM(
      GREATEST(inv.amount - COALESCE(paid.amount_paid, 0), 0)
    ), 0)::numeric AS total_outstanding
    FROM user_properties up
    JOIN public.units u ON u.property_id = up.id
    JOIN public.leases l ON l.unit_id = u.id
    JOIN public.invoices inv ON inv.lease_id = l.id
    LEFT JOIN (
      SELECT 
        invoice_id,
        SUM(amount) AS amount_paid
      FROM public.payments
      WHERE status = 'completed'
      GROUP BY invoice_id
    ) paid ON paid.invoice_id = inv.id
    WHERE inv.due_date <= now()::date
  ),
  monthly_trend AS (
    SELECT 
      to_char(date_trunc('month', d), 'Mon') AS month,
      COALESCE((
        SELECT SUM(pay.amount)
        FROM public.payments pay
        JOIN public.leases l ON pay.lease_id = l.id
        JOIN public.units u ON l.unit_id = u.id
        JOIN user_properties up ON u.property_id = up.id
        WHERE pay.payment_date >= date_trunc('month', d)
          AND pay.payment_date < (date_trunc('month', d) + interval '1 month')
          AND pay.status IN ('completed', 'paid', 'success')
      ), 0)::numeric AS revenue,
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        JOIN user_properties up ON e.property_id = up.id
        WHERE e.expense_date >= date_trunc('month', d)
          AND e.expense_date < (date_trunc('month', d) + interval '1 month')
      ), 0)::numeric AS expenses
    FROM generate_series(
      date_trunc('month', v_start), 
      date_trunc('month', v_end), 
      interval '1 month'
    ) d
  ),
  kpis AS (
    SELECT
      ps.total_properties,
      ps.total_units,
      ps.occupied_units,
      CASE WHEN ps.total_units > 0 
        THEN ROUND((ps.occupied_units::numeric / ps.total_units::numeric) * 100, 1)
        ELSE 0 
      END AS occupancy_rate,
      fd.total_revenue,
      fd.total_expenses,
      (fd.total_revenue - fd.total_expenses) AS net_operating_income,
      ob.total_outstanding,
      -- Collection rate: current month payments / current month invoices
      CASE WHEN cmi.current_month_invoiced > 0
        THEN ROUND((fd.current_month_payments / cmi.current_month_invoiced) * 100, 1)
        ELSE 0
      END AS collection_rate
    FROM property_stats ps, financial_data fd, outstanding_balances ob, current_month_invoices cmi
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_properties', (SELECT total_properties FROM kpis),
      'total_units', (SELECT total_units FROM kpis),
      'occupied_units', (SELECT occupied_units FROM kpis),
      'occupancy_rate', (SELECT occupancy_rate FROM kpis),
      'total_revenue', (SELECT total_revenue FROM kpis),
      'total_expenses', (SELECT total_expenses FROM kpis),
      'net_operating_income', (SELECT net_operating_income FROM kpis),
      'total_outstanding', (SELECT total_outstanding FROM kpis),
      'collection_rate', (SELECT collection_rate FROM kpis)
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
      'summary', jsonb_build_array(
        jsonb_build_object('metric', 'Total Revenue (YTD)', 'value', (SELECT total_revenue FROM kpis)),
        jsonb_build_object('metric', 'Total Expenses (YTD)', 'value', (SELECT total_expenses FROM kpis)),
        jsonb_build_object('metric', 'Net Operating Income', 'value', (SELECT net_operating_income FROM kpis)),
        jsonb_build_object('metric', 'Outstanding Balances', 'value', (SELECT total_outstanding FROM kpis)),
        jsonb_build_object('metric', 'Collection Rate', 'value', (SELECT collection_rate FROM kpis) || '%'),
        jsonb_build_object('metric', 'Occupancy Rate', 'value', (SELECT occupancy_rate FROM kpis) || '%')
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;