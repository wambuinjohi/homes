-- Update check_plan_feature_access to give trial users full Enterprise access
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
begin
  -- Find subscription
  select bp.*, ls.status
  into v_plan
  from public.landlord_subscriptions ls
  join public.billing_plans bp on bp.id = ls.billing_plan_id
  where ls.landlord_id = _user_id
    and ls.status in ('active', 'trial')
  order by case when ls.status = 'active' then 1 else 2 end, ls.updated_at desc
  limit 1;

  if v_plan is null then
    return jsonb_build_object(
      'allowed', false,
      'is_limited', true,
      'limit', null,
      'remaining', null,
      'reason', 'no_active_subscription'
    );
  end if;

  -- CRITICAL: If user is on trial, give them FULL ENTERPRISE ACCESS
  if v_plan.status = 'trial' then
    -- Get the most premium plan (Enterprise or highest price plan)
    select * into v_enterprise_plan
    from public.billing_plans
    where is_active = true
      and (name = 'Enterprise' or name = 'Premium' or name = 'Professional')
    order by price desc
    limit 1;
    
    if v_enterprise_plan is not null then
      v_plan := v_enterprise_plan;
    end if;
  end if;

  -- Units limit check
  if _feature = 'units.max' then
    v_limit := v_plan.max_units;
    -- For unlimited plans (999 or null), no limits
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
    -- General feature inclusion
    v_allowed := exists (
      select 1
      from jsonb_array_elements_text(coalesce(v_plan.features, '[]'::jsonb)) as f(val)
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
    'status', v_plan.status,
    'plan_name', v_plan.name
  );
end;
$$;

-- Update create_default_landlord_subscription to use Enterprise plan for trials
create or replace function public.create_default_landlord_subscription()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  enterprise_plan_id uuid;
  trial_days integer := 14;
  sms_default integer := 100;
  grace_days integer := 7;
begin
  if NEW.role = 'Landlord'::public.app_role then
    -- Get trial settings
    select coalesce(
      (select (setting_value->>'trial_period_days')::int from public.billing_settings where setting_key = 'trial_settings' limit 1),
      (select (setting_value)::int from public.billing_settings where setting_key = 'trial_period_days' limit 1),
      14
    ) into trial_days;

    select coalesce(
      (select (setting_value->>'default_sms_credits')::int from public.billing_settings where setting_key = 'trial_settings' limit 1),
      (select (setting_value)::int from public.billing_settings where setting_key = 'default_sms_credits' limit 1),
      100
    ) into sms_default;

    select coalesce(
      (select (setting_value->>'grace_period_days')::int from public.billing_settings where setting_key = 'trial_settings' limit 1),
      (select grace_period_days from public.automated_billing_settings limit 1),
      7
    ) into grace_days;

    -- Get Enterprise plan (or most premium plan available)
    select id into enterprise_plan_id
    from public.billing_plans
    where is_active = true
      and (name = 'Enterprise' or name = 'Premium' or name = 'Professional')
    order by price desc
    limit 1;

    -- Fallback to any active plan if no premium plan exists
    if enterprise_plan_id is null then
      select id into enterprise_plan_id
      from public.billing_plans
      where is_active = true
      order by price desc, created_at asc
      limit 1;
    end if;

    if enterprise_plan_id is not null then
      insert into public.landlord_subscriptions (
        landlord_id, billing_plan_id, status, trial_start_date, trial_end_date,
        subscription_start_date, sms_credits_balance, auto_renewal, grace_period_days
      )
      values (
        NEW.user_id, enterprise_plan_id, 'trial', now(),
        now() + make_interval(days => trial_days), now(),
        sms_default, true, grace_days
      )
      on conflict (landlord_id) do nothing;
    end if;
  end if;

  return NEW;
end;
$$;