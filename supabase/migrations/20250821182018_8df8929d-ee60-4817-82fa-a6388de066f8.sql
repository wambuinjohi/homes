
-- Fix: qualify has_role and app_role in rent collection report so it runs with search_path disabled

CREATE OR REPLACE FUNCTION public.get_rent_collection_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_start date := coalesce(p_start_date, date_trunc('month', now())::date);
  v_end   date := coalesce(p_end_date, now()::date);
  v_result jsonb;
begin
  with
  relevant_invoices as (
    select 
      inv.*,
      u.id as unit_id,
      u.unit_number,
      p.id as property_id,
      p.name as property_name,
      t.id as tenant_id,
      t.first_name,
      t.last_name
    from public.invoices inv
    join public.leases l on inv.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    join public.tenants t on inv.tenant_id = t.id
    where inv.invoice_date >= v_start
      and inv.invoice_date <= v_end
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  payments_for_period as (
    select 
      pay.*
    from public.payments pay
    join public.leases l on pay.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    where pay.payment_date >= v_start
      and pay.payment_date <= v_end
      and pay.status = 'completed'
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or public.has_role(auth.uid(), 'Admin'::public.app_role))
  ),
  payments_by_invoice as (
    select 
      invoice_id, 
      coalesce(sum(amount), 0)::numeric as amount_paid
    from public.payments
    where status = 'completed'
      and payment_date <= v_end
      and invoice_id is not null
    group by invoice_id
  ),
  invoice_with_paid as (
    select 
      ri.*,
      coalesce(pbi.amount_paid, 0)::numeric as amount_paid_total
    from relevant_invoices ri
    left join payments_by_invoice pbi on pbi.invoice_id = ri.id
  ),
  kpis as (
    select
      coalesce(sum(ri.amount), 0)::numeric as total_due,
      (select coalesce(sum(amount), 0)::numeric from payments_for_period) as total_collected,
      greatest(
        coalesce(sum(ri.amount), 0)::numeric 
        - (select coalesce(sum(amount), 0)::numeric from payments_for_period),
        0
      )::numeric as outstanding_amount,
      case 
        when coalesce(sum(ri.amount), 0) > 0 then
          round(((select coalesce(sum(amount), 0)::numeric from payments_for_period) / coalesce(sum(ri.amount), 0)::numeric) * 100, 1)
        else 0
      end as collection_rate,
      sum(
        case 
          when ri.due_date < current_date and coalesce(ri.status, 'pending') <> 'paid' 
          then 1 
          else 0 
        end
      )::integer as late_payments
    from relevant_invoices ri
  ),
  collection_trend as (
    select 
      to_char(date_trunc('month', d), 'Mon') as month,
      coalesce((
        select sum(pay.amount)::numeric
        from public.payments pay
        join public.leases l on pay.lease_id = l.id
        join public.units u on l.unit_id = u.id
        join public.properties p on u.property_id = p.id
        where pay.payment_date >= date_trunc('month', d)
          and pay.payment_date < (date_trunc('month', d) + interval '1 month')
          and pay.status = 'completed'
          and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0) as collected,
      coalesce((
        select sum(inv.amount)::numeric
        from public.invoices inv
        join public.leases l on inv.lease_id = l.id
        join public.units u on l.unit_id = u.id
        join public.properties p on u.property_id = p.id
        where inv.invoice_date >= date_trunc('month', d)
          and inv.invoice_date < (date_trunc('month', d) + interval '1 month')
          and (p.owner_id = auth.uid() or p.manager_id = auth.uid() or public.has_role(auth.uid(), 'Admin'::public.app_role))
      ), 0) as expected
    from generate_series(date_trunc('month', v_start), date_trunc('month', v_end), interval '1 month') d
  ),
  payment_status as (
    select 'Paid'::text as name, count(*)::integer as value
    from invoice_with_paid
    where amount_paid_total >= amount
    union all
    select 'Partial', count(*) 
    from invoice_with_paid
    where amount_paid_total > 0 and amount_paid_total < amount
    union all
    select 'Overdue', count(*)
    from invoice_with_paid
    where amount_paid_total = 0 and due_date < current_date
  ),
  table_rows as (
    select 
      ri.property_name,
      ri.unit_number,
      (coalesce(ri.first_name, '') || ' ' || coalesce(ri.last_name, ''))::text as tenant_name,
      ri.amount::numeric as amount_due,
      coalesce(pbi.amount_paid, 0)::numeric as amount_paid,
      case 
        when coalesce(pbi.amount_paid, 0) >= ri.amount then 'Paid'
        when coalesce(pbi.amount_paid, 0) > 0 then 'Partial'
        when ri.due_date < current_date then 'Overdue'
        else coalesce(ri.status, 'pending')
      end as status
    from relevant_invoices ri
    left join payments_by_invoice pbi on pbi.invoice_id = ri.id
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_collected', (select total_collected from kpis),
      'collection_rate', (select collection_rate from kpis),
      'outstanding_amount', (select outstanding_amount from kpis),
      'late_payments', (select late_payments from kpis)
    ),
    'charts', jsonb_build_object(
      'collection_trend', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month', month,
          'collected', collected,
          'expected', expected
        )), '[]'::jsonb)
        from collection_trend
      ),
      'payment_status', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', name,
          'value', value
        )), '[]'::jsonb)
        from payment_status
      )
    ),
    'table', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'property_name', property_name,
        'unit_number', unit_number,
        'tenant_name', tenant_name,
        'amount_due', amount_due,
        'amount_paid', amount_paid,
        'status', status
      ) order by property_name, unit_number), '[]'::jsonb)
      from table_rows
    )
  ) into v_result;

  return v_result;
end;
$function$;
