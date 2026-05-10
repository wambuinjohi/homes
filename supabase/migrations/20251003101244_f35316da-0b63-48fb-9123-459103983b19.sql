-- Grant sub-users full Enterprise access during landlord trial
-- This removes permission barriers and updates RLS policies

-- 1. Update check_plan_feature_access to give sub-users unconditional Enterprise access during landlord trial
create or replace function public.check_plan_feature_access(
  _user_id uuid,
  _feature text,
  _current_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_plan record;
  v_allowed boolean := false;
  v_limit numeric := null;
  v_is_limited boolean := false;
  v_remaining numeric := null;
  v_enterprise_plan record;
  v_landlord_id uuid;
  v_landlord_on_trial boolean := false;
begin
  -- Early return for sub-users on landlord trial with full Enterprise access
  v_landlord_id := public.get_sub_user_landlord(_user_id);
  
  if v_landlord_id is not null then
    v_landlord_on_trial := public.get_landlord_trial_status(v_landlord_id);
    
    if v_landlord_on_trial then
      -- Get Enterprise plan
      select * into v_enterprise_plan
      from public.billing_plans
      where is_active = true
        and (name in ('Enterprise', 'Premium', 'Professional'))
      order by price desc
      limit 1;

      if v_enterprise_plan is not null then
        -- Handle limits for unit/SMS features
        if _feature = 'units.max' then
          v_limit := v_enterprise_plan.max_units;
          if v_limit is null or v_limit >= 999 then
            v_is_limited := false;
            v_allowed := true;
            v_remaining := null;
          else
            v_is_limited := true;
            v_allowed := (_current_count <= v_limit);
            v_remaining := greatest(v_limit - _current_count, 0);
          end if;
        elsif _feature = 'sms.quota' then
          v_limit := v_enterprise_plan.sms_credits_included;
          v_is_limited := v_limit is not null;
          v_allowed := (v_limit is null) or (_current_count <= v_limit);
          if v_limit is not null then
            v_remaining := greatest(v_limit - _current_count, 0);
          end if;
        else
          -- All other features: check if in Enterprise plan features
          v_allowed := exists (
            select 1
            from jsonb_array_elements_text(coalesce(v_enterprise_plan.features, '[]'::jsonb)) f(val)
            where val = _feature
          );
          v_is_limited := false;
          v_limit := null;
          v_remaining := null;
        end if;

        return jsonb_build_object(
          'allowed', v_allowed,
          'is_limited', v_is_limited,
          'limit', v_limit,
          'remaining', v_remaining,
          'status', 'trial',
          'plan_name', v_enterprise_plan.name,
          'reason', 'sub_user_on_landlord_trial'
        );
      end if;
    end if;
  end if;

  -- Rest of the function for non-sub-users (existing logic)
  select bp.*, ls.status as subscription_status, ls.trial_end_date
  into v_plan
  from public.landlord_subscriptions ls
  join public.billing_plans bp on bp.id = ls.billing_plan_id
  where ls.landlord_id = _user_id
    and bp.is_active = true
  limit 1;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'is_limited', true,
      'reason', 'no_active_subscription',
      'status', 'inactive'
    );
  end if;

  if v_plan.subscription_status = 'trial' and v_plan.trial_end_date < now() then
    return jsonb_build_object(
      'allowed', false,
      'is_limited', true,
      'reason', 'trial_expired',
      'status', 'expired'
    );
  end if;

  if _feature = 'properties.max' then
    v_limit := v_plan.max_properties;
    if v_limit is null or v_limit >= 999 then
      v_is_limited := false;
      v_allowed := true;
      v_remaining := null;
    else
      v_is_limited := true;
      v_allowed := (_current_count <= v_limit);
      v_remaining := greatest(v_limit - _current_count, 0);
    end if;
  elsif _feature = 'units.max' then
    v_limit := v_plan.max_units;
    if v_limit is null or v_limit >= 999 then
      v_is_limited := false;
      v_allowed := true;
      v_remaining := null;
    else
      v_is_limited := true;
      v_allowed := (_current_count <= v_limit);
      v_remaining := greatest(v_limit - _current_count, 0);
    end if;
  elsif _feature = 'sms.quota' then
    v_limit := v_plan.sms_credits_included;
    v_is_limited := v_limit is not null;
    v_allowed := (v_limit is null) or (_current_count <= v_limit);
    if v_limit is not null then
      v_remaining := greatest(v_limit - _current_count, 0);
    end if;
  else
    v_allowed := exists (
      select 1
      from jsonb_array_elements_text(coalesce(v_plan.features, '[]'::jsonb)) f(val)
      where val = _feature
    );
    v_is_limited := false;
    v_limit := null;
    v_remaining := null;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'is_limited', v_is_limited,
    'limit', v_limit,
    'remaining', v_remaining,
    'status', v_plan.subscription_status,
    'plan_name', v_plan.name
  );
end;
$$;

-- 2. Add RLS policy for sub-users to manage invoices during landlord trial
create policy "Sub-users manage invoices during landlord trial"
on public.invoices
for all
using (
  exists (
    select 1
    from public.leases l
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where l.id = invoices.lease_id
      and p.owner_id = public.get_sub_user_landlord(auth.uid())
      and public.get_landlord_trial_status(public.get_sub_user_landlord(auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.leases l
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where l.id = invoices.lease_id
      and p.owner_id = public.get_sub_user_landlord(auth.uid())
      and public.get_landlord_trial_status(public.get_sub_user_landlord(auth.uid()))
  )
);

-- 3. Add RLS policy for sub-users to manage payments during landlord trial
create policy "Sub-users manage payments during landlord trial"
on public.payments
for all
using (
  exists (
    select 1
    from public.leases l
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where l.id = payments.lease_id
      and p.owner_id = public.get_sub_user_landlord(auth.uid())
      and public.get_landlord_trial_status(public.get_sub_user_landlord(auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.leases l
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where l.id = payments.lease_id
      and p.owner_id = public.get_sub_user_landlord(auth.uid())
      and public.get_landlord_trial_status(public.get_sub_user_landlord(auth.uid()))
  )
);

-- 4. Update get_invoice_overview to include sub-users during landlord trial
create or replace function public.get_invoice_overview(
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_status text default null
)
returns table(
  id uuid,
  lease_id uuid,
  tenant_id uuid,
  invoice_date date,
  due_date date,
  amount numeric,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  property_id uuid,
  property_owner_id uuid,
  property_manager_id uuid,
  amount_paid_allocated numeric,
  amount_paid_direct numeric,
  amount_paid_total numeric,
  outstanding_amount numeric,
  computed_status text,
  invoice_number text,
  property_name text,
  status text,
  description text,
  first_name text,
  last_name text,
  email text,
  phone text,
  unit_number text
)
language sql
security definer
set search_path = 'public'
as $$
  select
    i.id,
    i.lease_id,
    i.tenant_id,
    i.invoice_date,
    i.due_date,
    i.amount,
    i.created_at,
    i.updated_at,
    u.property_id,
    p.owner_id as property_owner_id,
    p.manager_id as property_manager_id,
    coalesce(pa.total_allocated, 0) as amount_paid_allocated,
    coalesce(py.total_direct, 0) as amount_paid_direct,
    coalesce(pa.total_allocated, 0) + coalesce(py.total_direct, 0) as amount_paid_total,
    greatest(i.amount - (coalesce(pa.total_allocated, 0) + coalesce(py.total_direct, 0)), 0) as outstanding_amount,
    case
      when i.amount <= (coalesce(pa.total_allocated, 0) + coalesce(py.total_direct, 0)) then 'paid'
      when i.due_date < current_date then 'overdue'
      else i.status
    end as computed_status,
    i.invoice_number,
    p.name as property_name,
    i.status,
    i.description,
    t.first_name,
    t.last_name,
    public.mask_sensitive_data(t.email, 3) as email,
    public.mask_sensitive_data(t.phone, 4) as phone,
    u.unit_number
  from public.invoices i
  join public.leases l on l.id = i.lease_id
  join public.units u on u.id = l.unit_id
  join public.properties p on p.id = u.property_id
  join public.tenants t on t.id = i.tenant_id
  left join (
    select pa_inner.invoice_id, sum(pa_inner.amount) as total_allocated
    from public.payment_allocations pa_inner
    group by pa_inner.invoice_id
  ) pa on pa.invoice_id = i.id
  left join (
    select py_inner.invoice_id, sum(py_inner.amount) as total_direct
    from public.payments py_inner
    where py_inner.status = 'completed'
    group by py_inner.invoice_id
  ) py on py.invoice_id = i.id
  where
    (
      has_role(auth.uid(), 'Admin'::app_role)
      or p.owner_id = auth.uid()
      or p.manager_id = auth.uid()
      or t.user_id = auth.uid()
      or (
        p.owner_id = public.get_sub_user_landlord(auth.uid())
        and public.get_landlord_trial_status(public.get_sub_user_landlord(auth.uid()))
      )
    )
    and (p_search is null or (
      i.invoice_number ilike '%' || p_search || '%'
      or t.first_name ilike '%' || p_search || '%'
      or t.last_name ilike '%' || p_search || '%'
      or p.name ilike '%' || p_search || '%'
    ))
    and (p_status is null or i.status = p_status)
  order by i.created_at desc
  limit p_limit offset p_offset;
$$;