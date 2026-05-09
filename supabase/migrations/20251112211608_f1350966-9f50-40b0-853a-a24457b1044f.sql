-- Update check_plan_feature_access to use billing_plan_features table
CREATE OR REPLACE FUNCTION public.check_plan_feature_access(
  _user_id uuid,
  _feature text,
  _current_count int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_landlord_id uuid;
  v_subscription record;
  v_plan record;
  v_is_sub_user boolean := false;
  v_sub_user_perms jsonb;
  v_is_enabled boolean;
  v_custom_limit int;
  v_limit int;
  v_remaining int;
  v_required_permission text;
BEGIN
  -- Check if user is a sub-user
  SELECT landlord_id, permissions INTO v_landlord_id, v_sub_user_perms
  FROM public.sub_users
  WHERE user_id = _user_id AND status = 'active';
  
  IF v_landlord_id IS NOT NULL THEN
    v_is_sub_user := true;
  ELSE
    v_landlord_id := _user_id;
  END IF;

  -- Get landlord subscription
  SELECT * INTO v_subscription
  FROM public.landlord_subscriptions
  WHERE landlord_id = v_landlord_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no subscription found, deny access
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'is_limited', true,
      'reason', 'no_subscription',
      'status', 'no_subscription',
      'plan_name', null
    );
  END IF;

  -- Get billing plan details
  SELECT * INTO v_plan
  FROM public.billing_plans
  WHERE id = v_subscription.billing_plan_id;

  -- TRIAL MODE: Allow all features during active trial
  IF v_subscription.status = 'trial' AND v_subscription.trial_end_date > now() THEN
    -- For sub-users on landlord trial
    IF v_is_sub_user THEN
      -- Check if sub-user has required permission
      v_required_permission := public.map_feature_to_permission(_feature);
      
      -- If feature is landlord-only (null permission), deny
      IF v_required_permission IS NULL THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'is_limited', true,
          'reason', 'landlord_only_feature',
          'status', 'trial',
          'plan_name', v_plan.name,
          'required_permission', 'landlord_only'
        );
      END IF;
      
      -- Check if sub-user has the required permission
      IF NOT COALESCE((v_sub_user_perms->>v_required_permission)::boolean, false) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'is_limited', true,
          'reason', 'insufficient_permissions',
          'status', 'trial',
          'plan_name', v_plan.name,
          'required_permission', v_required_permission
        );
      END IF;

      -- Sub-user has permission, allow with trial status
      RETURN jsonb_build_object(
        'allowed', true,
        'is_limited', false,
        'reason', 'sub_user_on_landlord_trial',
        'status', 'trial',
        'plan_name', v_plan.name
      );
    END IF;

    -- For landlords on trial: allow all features
    RETURN jsonb_build_object(
      'allowed', true,
      'is_limited', false,
      'reason', 'landlord_on_trial',
      'status', 'trial',
      'plan_name', v_plan.name
    );
  END IF;

  -- NON-TRIAL MODE: Check plan features using billing_plan_features table
  
  -- Special handling for limit-based features
  IF _feature = 'units.max' THEN
    v_limit := v_plan.max_units;
    IF v_limit IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'is_limited', true,
        'reason', 'feature_not_configured',
        'status', v_subscription.status,
        'plan_name', v_plan.name
      );
    END IF;
    
    v_remaining := v_limit - _current_count + 1;
    IF _current_count > v_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'is_limited', true,
        'limit', v_limit,
        'remaining', 0,
        'reason', 'limit_exceeded',
        'status', v_subscription.status,
        'plan_name', v_plan.name
      );
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'is_limited', true,
      'limit', v_limit,
      'remaining', v_remaining,
      'reason', 'within_limit',
      'status', v_subscription.status,
      'plan_name', v_plan.name
    );
  END IF;
  
  IF _feature = 'properties.max' THEN
    v_limit := v_plan.max_properties;
    IF v_limit IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'is_limited', true,
        'reason', 'feature_not_configured',
        'status', v_subscription.status,
        'plan_name', v_plan.name
      );
    END IF;
    
    v_remaining := v_limit - _current_count + 1;
    IF _current_count > v_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'is_limited', true,
        'limit', v_limit,
        'remaining', 0,
        'reason', 'limit_exceeded',
        'status', v_subscription.status,
        'plan_name', v_plan.name
      );
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'is_limited', true,
      'limit', v_limit,
      'remaining', v_remaining,
      'reason', 'within_limit',
      'status', v_subscription.status,
      'plan_name', v_plan.name
    );
  END IF;

  -- For toggle features, check billing_plan_features table
  SELECT bpf.is_enabled, bpf.custom_limit
  INTO v_is_enabled, v_custom_limit
  FROM public.billing_plan_features bpf
  WHERE bpf.billing_plan_id = v_subscription.billing_plan_id
    AND bpf.feature_key = _feature
  LIMIT 1;

  -- If feature not found in billing_plan_features, deny access
  IF v_is_enabled IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'is_limited', true,
      'reason', 'feature_not_in_plan',
      'status', v_subscription.status,
      'plan_name', v_plan.name
    );
  END IF;

  -- If feature is disabled, deny access
  IF v_is_enabled = false THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'is_limited', true,
      'reason', 'feature_disabled',
      'status', v_subscription.status,
      'plan_name', v_plan.name
    );
  END IF;

  -- For sub-users: check permissions even if plan allows feature
  IF v_is_sub_user THEN
    v_required_permission := public.map_feature_to_permission(_feature);
    
    IF v_required_permission IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'is_limited', true,
        'reason', 'landlord_only_feature',
        'status', v_subscription.status,
        'plan_name', v_plan.name,
        'required_permission', 'landlord_only'
      );
    END IF;
    
    IF NOT COALESCE((v_sub_user_perms->>v_required_permission)::boolean, false) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'is_limited', true,
        'reason', 'insufficient_permissions',
        'status', v_subscription.status,
        'plan_name', v_plan.name,
        'required_permission', v_required_permission
      );
    END IF;
  END IF;

  -- Check if feature has a custom limit
  IF v_custom_limit IS NOT NULL THEN
    v_remaining := v_custom_limit - _current_count + 1;
    
    IF _current_count > v_custom_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'is_limited', true,
        'limit', v_custom_limit,
        'remaining', 0,
        'reason', 'limit_exceeded',
        'status', v_subscription.status,
        'plan_name', v_plan.name
      );
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', true,
      'is_limited', true,
      'limit', v_custom_limit,
      'remaining', v_remaining,
      'reason', 'within_limit',
      'status', v_subscription.status,
      'plan_name', v_plan.name
    );
  END IF;

  -- Feature is enabled with no limits
  RETURN jsonb_build_object(
    'allowed', true,
    'is_limited', false,
    'reason', 'feature_included',
    'status', v_subscription.status,
    'plan_name', v_plan.name
  );
END;
$$;

COMMENT ON FUNCTION public.check_plan_feature_access(uuid, text, integer) IS 
'Checks feature access using billing_plan_features table. Preserves trial and sub-user permission logic.';