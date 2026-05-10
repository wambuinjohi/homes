-- Update get_executive_summary_report to include Portfolio Summary table
create or replace function public.get_executive_summary_report(
  p_start_date date default null,
  p_end_date date default null,
  p_include_tenant_scope boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_start date := coalesce(p_start_date, date_trunc('month', now())::date);
  v_end   date := coalesce(p_end_date, now()::date);
  v_is_admin boolean := public.has_role(auth.uid(), 'Admin'::public.app_role);
  v_result jsonb;
begin
  with
  -- Properties visible to this user:
  base_properties as (
    select p.id, p.name
    from public.properties p
    where v_is_admin
       or p.owner_id = auth.uid()
       or p.manager_id = auth.uid()
  ),
  -- Optional tenant-scope (includes properties where user is a tenant)
  tenant_properties as (
    select distinct u.property_id as id, p.name
    from public.tenants t
    join public.leases l on l.tenant_id = t.id
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where t.user_id = auth.uid()
  ),
  user_properties as (
    select id, name from base_properties
    union
    select id, name from tenant_properties
    where p_include_tenant_scope = true
  ),

  -- Payments in period, resolving property via lease or invoice path
  payments_scoped as (
    select
      pay.id,
      pay.amount,
      pay.payment_date,
      pay.status,
      coalesce(u.property_id, u2.property_id) as property_id
    from public.payments pay
    left join public.leases l on pay.lease_id = l.id
    left join public.units u on u.id = l.unit_id
    left join public.invoices inv on pay.invoice_id = inv.id
    left join public.leases l2 on inv.lease_id = l2.id
    left join public.units u2 on u2.id = l2.unit_id
    where pay.payment_date >= v_start
      and pay.payment_date <= v_end
      and pay.status in ('completed', 'paid', 'success')
  ),
  payments_in_scope as (
    select *
    from payments_scoped ps
    where ps.property_id in (select id from user_properties)
  ),

  -- Expenses in period scoped by property
  expenses_in_scope as (
    select e.*
    from public.expenses e
    where e.expense_date >= v_start
      and e.expense_date <= v_end
      and e.property_id in (select id from user_properties)
  ),

  -- Invoices for outstanding balances (up to end date)
  invoices_in_scope as (
    select inv.*
    from public.invoices inv
    join public.leases l on l.id = inv.lease_id
    join public.units u on u.id = l.unit_id
    where u.property_id in (select id from user_properties)
      and inv.invoice_date <= v_end
  ),
  invoice_payments_completed as (
    select p.invoice_id, sum(p.amount) as paid_amount
    from public.payments p
    where p.status = 'completed'
      and p.invoice_id is not null
      and p.payment_date <= v_end
    group by p.invoice_id
  ),
  outstanding_calc as (
    select
      coalesce(sum(greatest(inv.amount - coalesce(ipc.paid_amount, 0), 0)), 0)::numeric as total_outstanding
    from invoices_in_scope inv
    left join invoice_payments_completed ipc on ipc.invoice_id = inv.id
  ),

  -- Occupancy during the window
  units_in_scope as (
    select u.*
    from public.units u
    where u.property_id in (select id from user_properties)
  ),
  occupied_units as (
    select distinct u.id, u.property_id
    from public.units u
    join public.leases l on l.unit_id = u.id
    where u.property_id in (select id from user_properties)
      and l.lease_start_date <= v_end
      and l.lease_end_date >= v_start
      and coalesce(l.status, 'active') <> 'terminated'
  ),

  -- Portfolio Summary table data
  portfolio_summary as (
    select
      up.name as property_name,
      coalesce(unit_counts.total_units, 0) as units,
      coalesce(property_revenue.revenue, 0) as revenue,
      case 
        when coalesce(unit_counts.total_units, 0) > 0 then
          round((coalesce(occupancy_counts.occupied_units, 0)::numeric / unit_counts.total_units::numeric) * 100, 1)
        else 0 
      end as occupancy
    from user_properties up
    left join (
      select property_id, count(*) as total_units
      from units_in_scope
      group by property_id
    ) unit_counts on unit_counts.property_id = up.id
    left join (
      select property_id, sum(amount) as revenue
      from payments_in_scope
      group by property_id
    ) property_revenue on property_revenue.property_id = up.id
    left join (
      select property_id, count(*) as occupied_units
      from occupied_units
      group by property_id  
    ) occupancy_counts on occupancy_counts.property_id = up.id
    order by up.name
  ),

  -- Aggregations
  revenue_data as (
    select coalesce(sum(amount), 0)::numeric as total_revenue,
           count(*)::int as payment_count
    from payments_in_scope
  ),
  expense_data as (
    select coalesce(sum(amount), 0)::numeric as total_expenses,
           count(*)::int as expense_count
    from expenses_in_scope
  ),
  occupancy_data as (
    select
      (select count(*)::int from units_in_scope) as total_units,
      (select count(*)::int from occupied_units) as occupied_units
  ),
  meta_data as (
    select
      (select count(*)::int from user_properties) as property_count,
      (select count(*)::int from payments_in_scope) as payments_count,
      (select count(*)::int from expenses_in_scope) as expenses_count,
      (select count(*)::int from invoices_in_scope) as invoices_count,
      (select total_units from occupancy_data) as total_units,
      (select occupied_units from occupancy_data) as occupied_units
  )

  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_properties', (select property_count from meta_data),
      'total_units', (select total_units from occupancy_data),
      'total_revenue', (select total_revenue from revenue_data),
      'total_expenses', (select total_expenses from expense_data),
      'net_operating_income', (select total_revenue from revenue_data) - (select total_expenses from expense_data),
      'total_outstanding', (select total_outstanding from outstanding_calc),
      'collection_rate',
        case
          when (select (select total_revenue from revenue_data) + (select total_outstanding from outstanding_calc)) > 0
            then round(((select total_revenue from revenue_data) /
                       ((select total_revenue from revenue_data) + (select total_outstanding from outstanding_calc))) * 100, 1)
          else 0 end,
      'occupancy_rate',
        case
          when (select total_units from occupancy_data) > 0
            then round(((select occupied_units from occupancy_data)::numeric / (select total_units from occupancy_data)::numeric) * 100, 1)
          else 0 end
    ),
    'charts', jsonb_build_object(),
    'table', coalesce((
      select jsonb_agg(jsonb_build_object(
        'report_date', v_end,
        'property_name', property_name,
        'units', units,
        'revenue', revenue,
        'occupancy', occupancy
      ))
      from portfolio_summary
    ), '[]'::jsonb),
    'meta', jsonb_build_object(
      'property_count', (select property_count from meta_data),
      'properties_count', (select property_count from meta_data),
      'payments_count', (select payments_count from meta_data),
      'expenses_count', (select expenses_count from meta_data),
      'invoices_count', (select invoices_count from meta_data),
      'total_units', (select total_units from meta_data),
      'occupied_units', (select occupied_units from meta_data)
    )
  )
  into v_result;

  return v_result;
end;
$$;