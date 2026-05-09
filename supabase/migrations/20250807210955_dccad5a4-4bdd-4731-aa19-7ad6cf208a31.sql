-- Create user_audit_logs table for tracking admin actions
CREATE TABLE public.user_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  performed_by UUID NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_status table for managing user status
CREATE TABLE public.user_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create impersonation_sessions table for tracking impersonation
CREATE TABLE public.impersonation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  impersonated_user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_audit_logs
CREATE POLICY "Admins can manage audit logs" 
ON public.user_audit_logs 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for user_status
CREATE POLICY "Admins can manage user status" 
ON public.user_status 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own status" 
ON public.user_status 
FOR SELECT 
USING (user_id = auth.uid());

-- Create RLS policies for impersonation_sessions
CREATE POLICY "Admins can manage impersonation sessions" 
ON public.impersonation_sessions 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create log_user_audit function
CREATE OR REPLACE FUNCTION public.log_user_audit(
  _user_id UUID,
  _action TEXT,
  _entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL,
  _details JSONB DEFAULT '{}',
  _performed_by UUID DEFAULT NULL,
  _ip_address INET DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.user_audit_logs (
    user_id, action, entity_type, entity_id, details, 
    performed_by, ip_address, user_agent
  ) VALUES (
    _user_id, _action, _entity_type, _entity_id, _details,
    COALESCE(_performed_by, auth.uid()), _ip_address, _user_agent
  );
END;
$$;

-- Create get_user_audit_history function
CREATE OR REPLACE FUNCTION public.get_user_audit_history(
  _user_id UUID,
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  performed_by UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ual.id, ual.action, ual.entity_type, ual.entity_id, ual.details,
    ual.performed_by, ual.ip_address, ual.user_agent, ual.created_at
  FROM public.user_audit_logs ual
  WHERE ual.user_id = _user_id
  ORDER BY ual.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

-- Create suspend_user function
CREATE OR REPLACE FUNCTION public.suspend_user(
  _user_id UUID,
  _reason TEXT DEFAULT 'Administrative action',
  _performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  -- Insert or update user status
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'suspended', _reason, v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'suspended',
    reason = _reason,
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  -- Log the action
  PERFORM public.log_user_audit(
    _user_id, 'suspend', 'user', _user_id,
    jsonb_build_object('reason', _reason),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User suspended successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create activate_user function
CREATE OR REPLACE FUNCTION public.activate_user(
  _user_id UUID,
  _performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  -- Insert or update user status
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'active', 'User activated', v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'active',
    reason = 'User activated',
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  -- Log the action
  PERFORM public.log_user_audit(
    _user_id, 'activate', 'user', _user_id,
    jsonb_build_object('reason', 'User activated'),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User activated successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create soft_delete_user function
CREATE OR REPLACE FUNCTION public.soft_delete_user(
  _user_id UUID,
  _reason TEXT DEFAULT 'Administrative deletion',
  _performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  v_performed_by := COALESCE(_performed_by, auth.uid());
  
  -- Insert or update user status
  INSERT INTO public.user_status (user_id, status, reason, changed_by)
  VALUES (_user_id, 'deleted', _reason, v_performed_by)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    status = 'deleted',
    reason = _reason,
    changed_by = v_performed_by,
    changed_at = now(),
    updated_at = now();
  
  -- Log the action
  PERFORM public.log_user_audit(
    _user_id, 'soft_delete', 'user', _user_id,
    jsonb_build_object('reason', _reason),
    v_performed_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User soft deleted successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_status_updated_at
  BEFORE UPDATE ON public.user_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_impersonation_sessions_updated_at
  BEFORE UPDATE ON public.impersonation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();