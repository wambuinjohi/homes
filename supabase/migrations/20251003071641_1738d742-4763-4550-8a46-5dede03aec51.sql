-- Migration: Secure sub-user trial access with permission checks
-- Description: Sub-users get advanced features during landlord trial ONLY if landlord grants specific permissions

-- Helper function: Map features to sub-user permission keys
create or replace function public.map_feature_to_permission(_feature text)
returns text
language sql
stable
security definer
set search_path = 'public'
as $$
  select case
    -- Reports
    when _feature in ('reports.advanced', 'reports.financial', 'reports.basic') then 'view_reports'
    
    -- Properties & Units
    when _feature in ('properties.max', 'units.max') then 'manage_properties'
    
    -- Tenants
    when _feature in ('tenants.max') then 'manage_tenants'
    
    -- Invoicing
    when _feature in ('invoicing.basic', 'invoicing.advanced') then 'manage_invoices'
    
    -- Expenses
    when _feature in ('expenses.tracking') then 'manage_expenses'
    
    -- Maintenance
    when _feature in ('maintenance.tracking') then 'manage_maintenance'
    
    -- Communications
    when _feature in ('sms.quota', 'notifications.sms', 'notifications.email') then 'send_communications'
    when _feature in ('communication.email_templates', 'communication.sms_templates') then 'send_communications'
    
    -- Bulk operations require multiple permissions
    when _feature = 'operations.bulk' then 'manage_properties' -- needs at least one management permission
    
    -- Landlord-only features (no sub-user access even with permissions)
    when _feature in (
      'team.sub_users',           -- Sub-users cannot manage other sub-users
      'billing.automated',         -- Only landlord can manage billing
      'branding.white_label',      -- Only landlord can manage branding
      'branding.custom',
      'support.dedicated',         -- Landlord-level support
      'support.priority'
    ) then null  -- null means landlord-only
    
    else null  -- Unknown features default to landlord-only
  end;
$$;

comment on function public.map_feature_to_permission(text) is 
'Maps feature names to sub-user permission keys. Returns NULL for landlord-only features.';

-- Updated check_plan_feature_access with permission-based trial logic
create or replace function public.check_plan_feature_access(_user_id uuid, _feature text, _current_count integer default 1)
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
  v_required_permission text;
  v_has_permission boolean := false;
begin
  -- Check if user is a sub-user
  v_landlord_id := get_sub_user_landlord(_user_id);
  
  if v_landlord_id is not null then
    -- User is a sub-user, check landlord's trial status
    v_landlord_on_trial := get_landlord_trial_status(v_landlord_id);
    
    if v_landlord_on_trial then
      -- PERMISSION-BASED TRIAL ACCESS
      -- Map feature to required permission
      v_required_permission := map_feature_to_permission(_feature);
      
      -- Check if this is a landlord-only feature
      if v_required_permission is null then
        return jsonb_build_object(
          'allowed', false,
          'is_limited', true,
          'limit', null,
          'remaining', null,
          'status', 'trial',
          'reason', 'landlord_only_feature',
          'plan_name', 'Enterprise'
        );
      end if;
      
      -- Check if landlord granted this permission
      v_has_permission := get_sub_user_permissions(_user_id, v_required_permission);
      
      if not v_has_permission then
        return jsonb_build_object(
          'allowed', false,
          'is_limited', true,
          'limit', null,
          'remaining', null,
          'status', 'trial',
          'reason', 'permission_denied_by_landlord',
          'required_permission', v_required_permission,
          'plan_name', 'Enterprise'
        );
      end if;
      
      -- Permission granted! Get Enterprise plan for feature check
      select * into v_enterprise_plan
      from public.billing_plans
      where is_active = true
        and (name = 'Enterprise' or name = 'Premium' or name = 'Professional')
      order by price desc
      limit 1;
      
      if v_enterprise_plan is not null then
        -- Check feature access against Enterprise plan
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
          v_allowed := exists (
            select 1
            from jsonb_array_elements_text(coalesce(v_enterprise_plan.features, '[]'::jsonb)) as f(val)
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
          'reason', 'sub_user_permitted_during_landlord_trial',
          'required_permission', v_required_permission
        );
      end if;
    end if;
  end if;

  -- Original logic for non-sub-users or sub-users after trial...
  select bp.*, ls.status
  into v_plan
  from public.landlord_subscriptions ls
  join public.billing_plans bp on bp.id = ls.billing_plan_id
  where ls.landlord_id = coalesce(v_landlord_id, _user_id)
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

  -- If user is on trial (non-sub-user), give them FULL ENTERPRISE ACCESS
  if v_plan.status = 'trial' then
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

comment on function public.check_plan_feature_access(uuid, text, integer) is 
'Checks feature access with permission-based trial logic. Sub-users get Enterprise features during landlord trial ONLY if landlord granted specific permissions.';