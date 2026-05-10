-- Enhanced User & Role Management System

-- Create permissions table for fine-grained access control
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL, -- 'users', 'properties', 'maintenance', 'reports', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- Create user_sessions table to track login history
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_time TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  location TEXT,
  session_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_activity_logs table for audit trail
CREATE TABLE public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT, -- 'property', 'tenant', 'maintenance', etc.
  entity_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions
CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL USING (has_role(auth.uid(), 'Admin'));

-- RLS Policies for role_permissions  
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
  FOR ALL USING (has_role(auth.uid(), 'Admin'));

-- RLS Policies for user_sessions
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (has_role(auth.uid(), 'Admin'));

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for user_activity_logs
CREATE POLICY "Users can view their own activity" ON public.user_activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.user_activity_logs
  FOR SELECT USING (has_role(auth.uid(), 'Admin'));

CREATE POLICY "System can insert activity logs" ON public.user_activity_logs
  FOR INSERT WITH CHECK (true);

-- Insert default permissions
INSERT INTO public.permissions (name, description, category) VALUES
  -- User Management
  ('users.view', 'View users list', 'users'),
  ('users.create', 'Create new users', 'users'),
  ('users.edit', 'Edit user details', 'users'),
  ('users.delete', 'Delete users', 'users'),
  ('users.roles.manage', 'Manage user roles', 'users'),
  ('users.impersonate', 'Login as other users', 'users'),
  
  -- Property Management
  ('properties.view', 'View properties', 'properties'),
  ('properties.create', 'Create new properties', 'properties'),
  ('properties.edit', 'Edit property details', 'properties'),
  ('properties.delete', 'Delete properties', 'properties'),
  
  -- Unit Management
  ('units.view', 'View units', 'units'),
  ('units.create', 'Create new units', 'units'),
  ('units.edit', 'Edit unit details', 'units'),
  ('units.delete', 'Delete units', 'units'),
  
  -- Tenant Management
  ('tenants.view', 'View tenants', 'tenants'),
  ('tenants.create', 'Add new tenants', 'tenants'),
  ('tenants.edit', 'Edit tenant details', 'tenants'),
  ('tenants.delete', 'Remove tenants', 'tenants'),
  
  -- Lease Management
  ('leases.view', 'View leases', 'leases'),
  ('leases.create', 'Create new leases', 'leases'),
  ('leases.edit', 'Edit lease details', 'leases'),
  ('leases.delete', 'Delete leases', 'leases'),
  
  -- Financial Management
  ('payments.view', 'View payments', 'financial'),
  ('payments.create', 'Record payments', 'financial'),
  ('payments.edit', 'Edit payment records', 'financial'),
  ('invoices.view', 'View invoices', 'financial'),
  ('invoices.create', 'Create invoices', 'financial'),
  ('invoices.edit', 'Edit invoices', 'financial'),
  ('expenses.view', 'View expenses', 'financial'),
  ('expenses.create', 'Record expenses', 'financial'),
  ('expenses.edit', 'Edit expenses', 'financial'),
  
  -- Maintenance Management
  ('maintenance.view', 'View maintenance requests', 'maintenance'),
  ('maintenance.create', 'Create maintenance requests', 'maintenance'),
  ('maintenance.edit', 'Edit maintenance requests', 'maintenance'),
  ('maintenance.assign', 'Assign maintenance tasks', 'maintenance'),
  
  -- Reports & Analytics
  ('reports.view', 'View reports', 'reports'),
  ('reports.export', 'Export reports', 'reports'),
  ('analytics.view', 'View analytics dashboard', 'reports'),
  
  -- System Administration
  ('system.settings', 'Manage system settings', 'system'),
  ('system.backup', 'Perform system backups', 'system'),
  ('system.logs', 'View system logs', 'system');

-- Assign default permissions to roles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'Admin', p.id FROM public.permissions p;

-- Landlord permissions (property management focused)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'Landlord', p.id FROM public.permissions p
WHERE p.category IN ('properties', 'units', 'tenants', 'leases', 'financial', 'maintenance', 'reports');

-- Manager permissions (day-to-day operations)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'Manager', p.id FROM public.permissions p
WHERE p.name IN (
  'properties.view', 'properties.edit',
  'units.view', 'units.edit',
  'tenants.view', 'tenants.create', 'tenants.edit',
  'leases.view', 'leases.create', 'leases.edit',
  'payments.view', 'payments.create',
  'invoices.view', 'invoices.create',
  'maintenance.view', 'maintenance.create', 'maintenance.edit', 'maintenance.assign',
  'reports.view'
);

-- Agent permissions (limited operations)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'Agent', p.id FROM public.permissions p
WHERE p.name IN (
  'properties.view',
  'units.view',
  'tenants.view', 'tenants.create',
  'leases.view', 'leases.create',
  'maintenance.view', 'maintenance.create',
  'reports.view'
);

-- Tenant permissions (self-service)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'Tenant', p.id FROM public.permissions p
WHERE p.name IN (
  'payments.view',
  'invoices.view',
  'maintenance.create',
  'maintenance.view'
);

-- Create function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND p.name = _permission
  )
$$;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_name text, category text, description text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT p.name, p.category, p.description
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = _user_id
  ORDER BY p.category, p.name
$$;

-- Create trigger to update user_sessions updated_at
CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to log user activity
CREATE OR REPLACE FUNCTION public.log_user_activity(
  _user_id uuid,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _details jsonb DEFAULT NULL,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.user_activity_logs (
    user_id, action, entity_type, entity_id, details, ip_address, user_agent
  ) VALUES (
    _user_id, _action, _entity_type, _entity_id, _details, _ip_address, _user_agent
  );
$$;