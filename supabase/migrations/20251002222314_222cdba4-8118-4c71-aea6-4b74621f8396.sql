-- Create helper function to check if a landlord is on trial
CREATE OR REPLACE FUNCTION public.get_landlord_trial_status(_landlord_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.landlord_subscriptions 
    WHERE landlord_id = _landlord_id
      AND status = 'trial'
      AND trial_end_date > now()
  );
$$;

-- Update check_plan_feature_access to grant sub-users their landlord's trial benefits
CREATE OR REPLACE FUNCTION public.check_plan_feature_access(_user_id uuid, _feature text, _current_count integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- Check if user is a sub-user
  v_landlord_id := get_sub_user_landlord(_user_id);
  
  IF v_landlord_id IS NOT NULL THEN
    -- User is a sub-user, check landlord's trial status
    v_landlord_on_trial := get_landlord_trial_status(v_landlord_id);
    
    IF v_landlord_on_trial THEN
      -- Grant full Enterprise access during landlord's trial
      -- Get the most premium plan (Enterprise or highest price plan)
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
          'reason', 'sub_user_on_landlord_trial'
        );
      end if;
    END IF;
  END IF;

  -- Find subscription (original logic for non-sub-users or sub-users after trial)
  select bp.*, ls.status
  into v_plan
  from public.landlord_subscriptions ls
  join public.billing_plans bp on bp.id = ls.billing_plan_id
  where ls.landlord_id = COALESCE(v_landlord_id, _user_id)
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

  -- If user is on trial, give them FULL ENTERPRISE ACCESS
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
$function$;

-- Update RLS policies to grant sub-users full access during landlord's trial

-- Properties: Sub-users get full access during landlord's trial
DROP POLICY IF EXISTS "Property stakeholders and sub-users can manage properties" ON public.properties;
CREATE POLICY "Property stakeholders and sub-users can manage properties"
ON public.properties
FOR ALL
USING (
  owner_id = auth.uid() 
  OR manager_id = auth.uid() 
  OR has_role(auth.uid(), 'Admin'::app_role)
  OR (
    owner_id = get_sub_user_landlord(auth.uid())
    AND (
      get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
      OR get_sub_user_permissions(auth.uid(), 'manage_properties')
    )
  )
);

-- Tenants: Sub-users get full access during landlord's trial
DROP POLICY IF EXISTS "Sub-users can view tenants" ON public.tenants;
CREATE POLICY "Sub-users can view and manage tenants during landlord trial"
ON public.tenants
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR (EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = tenants.id
      AND (
        p.owner_id = auth.uid() 
        OR p.manager_id = auth.uid()
        OR (
          p.owner_id = get_sub_user_landlord(auth.uid())
          AND (
            get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
            OR get_sub_user_permissions(auth.uid(), 'manage_tenants')
          )
        )
      )
  ))
);

-- Leases: Sub-users get full access during landlord's trial
DROP POLICY IF EXISTS "Sub-users can view leases" ON public.leases;
CREATE POLICY "Sub-users can view and manage leases during landlord trial"
ON public.leases
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR (EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON u.property_id = p.id
    WHERE u.id = leases.unit_id
      AND (
        p.owner_id = auth.uid()
        OR p.manager_id = auth.uid()
        OR (
          p.owner_id = get_sub_user_landlord(auth.uid())
          AND (
            get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
            OR get_sub_user_permissions(auth.uid(), 'manage_leases')
          )
        )
      )
  ))
  OR (EXISTS (
    SELECT 1 FROM tenants t
    WHERE t.id = leases.tenant_id AND t.user_id = auth.uid()
  ))
);

-- Maintenance: Sub-users get full access during landlord's trial
DROP POLICY IF EXISTS "Sub-users can view maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Sub-users can view and manage maintenance during landlord trial"
ON public.maintenance_requests
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = maintenance_requests.property_id
      AND (
        p.owner_id = auth.uid()
        OR p.manager_id = auth.uid()
        OR (
          p.owner_id = get_sub_user_landlord(auth.uid())
          AND (
            get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
            OR get_sub_user_permissions(auth.uid(), 'manage_maintenance')
          )
        )
      )
  ))
  OR (EXISTS (
    SELECT 1 FROM tenants t
    WHERE t.id = maintenance_requests.tenant_id AND t.user_id = auth.uid()
  ))
);

-- Units: Sub-users get full access during landlord's trial
DROP POLICY IF EXISTS "Property stakeholders can manage units" ON public.units;
CREATE POLICY "Property stakeholders and sub-users can manage units"
ON public.units
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR has_role(auth.uid(), 'Landlord'::app_role)
  OR (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = units.property_id
      AND (
        p.owner_id = auth.uid()
        OR p.manager_id = auth.uid()
        OR (
          p.owner_id = get_sub_user_landlord(auth.uid())
          AND (
            get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
            OR get_sub_user_permissions(auth.uid(), 'manage_properties')
          )
        )
      )
  ))
);

-- Expenses: Sub-users get full access during landlord's trial
DROP POLICY IF EXISTS "Property owners can manage their expenses" ON public.expenses;
CREATE POLICY "Property stakeholders and sub-users can manage expenses"
ON public.expenses
FOR ALL
USING (
  has_role(auth.uid(), 'Admin'::app_role)
  OR (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = expenses.property_id
      AND (
        p.owner_id = auth.uid()
        OR p.manager_id = auth.uid()
        OR (
          p.owner_id = get_sub_user_landlord(auth.uid())
          AND (
            get_landlord_trial_status(get_sub_user_landlord(auth.uid()))
            OR get_sub_user_permissions(auth.uid(), 'manage_expenses')
          )
        )
      )
  ))
);