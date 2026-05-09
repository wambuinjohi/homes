-- Add report_runs table to track actual report generation
CREATE TABLE IF NOT EXISTS public.report_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  report_type text NOT NULL,
  filters jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'completed',
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  file_size_bytes bigint,
  execution_time_ms integer,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for report_runs
CREATE POLICY "Users can view their own report runs"
ON public.report_runs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own report runs"
ON public.report_runs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all report runs"
ON public.report_runs
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Update get_executive_summary_report function to include detailed breakdown
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
  WITH property_revenue AS (
    SELECT 
      p.id AS property_id,
      p.name AS property_name,
      COUNT(DISTINCT u.id) AS total_units,
      COUNT(DISTINCT CASE WHEN l.lease_start_date <= v_end AND l.lease_end_date >= v_start 
                          AND COALESCE(l.status, 'active') <> 'terminated' 
                     THEN u.id END) AS occupied_units,
      COALESCE(SUM(CASE WHEN pay.payment_date >= v_start AND pay.payment_date <= v_end 
                        AND pay.status IN ('completed', 'paid', 'success')
                   THEN pay.amount ELSE 0 END), 0) AS revenue
    FROM public.properties p
    LEFT JOIN public.units u ON u.property_id = p.id
    LEFT JOIN public.leases l ON l.unit_id = u.id
    LEFT JOIN public.payments pay ON pay.lease_id = l.id
    WHERE (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
    GROUP BY p.id, p.name
  ),
  total_revenue AS (
    SELECT COALESCE(SUM(pay.amount), 0) AS amount
    FROM public.payments pay
    JOIN public.leases l ON pay.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE pay.payment_date >= v_start
      AND pay.payment_date <= v_end
      AND pay.status IN ('completed', 'paid', 'success')
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  ),
  total_expenses AS (
    SELECT COALESCE(SUM(e.amount), 0) AS amount
    FROM public.expenses e
    JOIN public.properties p ON e.property_id = p.id
    WHERE e.expense_date >= v_start
      AND e.expense_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  ),
  outstanding_invoices AS (
    SELECT 
      COALESCE(SUM(
        GREATEST(
          inv.amount - COALESCE(
            (SELECT SUM(pay.amount) 
             FROM public.payments pay 
             WHERE pay.invoice_id = inv.id 
               AND pay.status = 'completed'), 
            0
          ), 
          0
        )
      ), 0) AS total_outstanding
    FROM public.invoices inv
    JOIN public.leases l ON inv.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE inv.invoice_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  ),
  expected_revenue AS (
    SELECT COALESCE(SUM(inv.amount), 0) AS amount
    FROM public.invoices inv
    JOIN public.leases l ON inv.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE inv.invoice_date >= v_start
      AND inv.invoice_date <= v_end
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', (SELECT amount FROM total_revenue),
      'total_expenses', (SELECT amount FROM total_expenses),
      'net_operating_income', (SELECT amount FROM total_revenue) - (SELECT amount FROM total_expenses),
      'total_outstanding', (SELECT total_outstanding FROM outstanding_invoices),
      'collection_rate', 
        CASE 
          WHEN (SELECT amount FROM expected_revenue) > 0 THEN
            ROUND(((SELECT amount FROM total_revenue) / (SELECT amount FROM expected_revenue)) * 100, 1)
          ELSE 0
        END,
      'occupancy_rate',
        CASE 
          WHEN (SELECT SUM(total_units) FROM property_revenue) > 0 THEN
            ROUND((SELECT SUM(occupied_units)::numeric FROM property_revenue) / (SELECT SUM(total_units)::numeric FROM property_revenue) * 100, 1)
          ELSE 0
        END
    ),
    'charts', jsonb_build_object(
      'revenue_trend', '[]'::jsonb,
      'expense_breakdown', '[]'::jsonb
    ),
    'table', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'report_date', v_end,
        'property_name', property_name,
        'units', total_units,
        'revenue', revenue,
        'occupancy', 
          CASE 
            WHEN total_units > 0 THEN
              ROUND((occupied_units::numeric / total_units::numeric) * 100, 1)
            ELSE 0
          END
      ))
      FROM property_revenue
      ORDER BY property_name
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;