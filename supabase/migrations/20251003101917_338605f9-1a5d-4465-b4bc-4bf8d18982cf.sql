-- Fix check_plan_feature_access to return status='trial' for sub-users on landlord trial
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