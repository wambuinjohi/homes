
-- Create a secure function to check plan-based feature access for subscribed users
-- Uses existing billing_plans columns:
--   - features (jsonb array of feature keys)
--   - max_units (int) for unit limits
--   - sms_credits_included (int) for SMS quotas
-- Expects feature keys like:
--   'units.max', 'sms.quota', 'integrations.api', 'integrations.accounting',
--   'team.roles', 'branding.white_label', 'reports.advanced', etc.

create or replace function public.check_plan_feature_access(
  _user_id uuid,
  _feature text,
  _current_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan record;
  v_allowed boolean := false;
  v_limit numeric := null;
  v_is_limited boolean := false;
  v_remaining numeric := null;
begin
  -- Find an active (or trial) subscription and its plan
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

  -- Units limit check
  if _feature = 'units.max' then
    v_limit := v_plan.max_units;
    v_is_limited := v_limit is not null;
    v_allowed := (v_limit is null) or (_current_count <= v_limit);
    if v_limit is not null then
      v_remaining := greatest(v_limit - _current_count, 0);
    end if;

  -- SMS quota check (for monthly included SMS)
  elsif _feature = 'sms.quota' then
    v_limit := v_plan.sms_credits_included;
    v_is_limited := v_limit is not null;
    v_allowed := (v_limit is null) or (_current_count <= v_limit);
    if v_limit is not null then
      v_remaining := greatest(v_limit - _current_count, 0);
    end if;

  -- General feature inclusion: check features array on the plan
  else
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

-- No RLS changes needed (function runs as definer). Keep plan data managed via Admin UI.
