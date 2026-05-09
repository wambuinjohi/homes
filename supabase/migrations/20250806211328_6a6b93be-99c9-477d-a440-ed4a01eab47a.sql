-- Create trial management and onboarding tables
CREATE TABLE public.trial_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  trial_duration_days INTEGER NOT NULL DEFAULT 30,
  features_enabled JSONB NOT NULL DEFAULT '[]',
  limitations JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create onboarding steps configuration
CREATE TABLE public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  component_name TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  user_roles TEXT[] NOT NULL DEFAULT ARRAY['Landlord'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user onboarding progress tracking
CREATE TABLE public.user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  step_id UUID REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, step_id)
);

-- Create feature tours and tutorials
CREATE TABLE public.feature_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  target_page TEXT NOT NULL,
  user_roles TEXT[] NOT NULL DEFAULT ARRAY['Landlord'],
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user feature tour progress
CREATE TABLE public.user_tour_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tour_id UUID REFERENCES public.feature_tours(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'dismissed')),
  current_step INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tour_id)
);

-- Create trial usage tracking
CREATE TABLE public.trial_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature_name)
);

-- Add trial-specific columns to landlord_subscriptions
ALTER TABLE public.landlord_subscriptions 
ADD COLUMN trial_features_enabled JSONB DEFAULT '[]',
ADD COLUMN trial_limitations JSONB DEFAULT '{}',
ADD COLUMN trial_usage_data JSONB DEFAULT '{}',
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS for all new tables
ALTER TABLE public.trial_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trial_configurations
CREATE POLICY "Admins can manage trial configurations" ON public.trial_configurations
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view active trial configurations" ON public.trial_configurations
FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Create RLS policies for onboarding_steps
CREATE POLICY "Admins can manage onboarding steps" ON public.onboarding_steps
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their relevant onboarding steps" ON public.onboarding_steps
FOR SELECT USING (
  is_active = true AND (
    (has_role(auth.uid(), 'Admin'::app_role)) OR
    (has_role(auth.uid(), 'Landlord'::app_role) AND 'Landlord' = ANY(user_roles)) OR
    (EXISTS(SELECT 1 FROM tenants WHERE user_id = auth.uid()) AND 'Tenant' = ANY(user_roles))
  )
);

-- Create RLS policies for user_onboarding_progress
CREATE POLICY "Users can manage their own onboarding progress" ON public.user_onboarding_progress
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all onboarding progress" ON public.user_onboarding_progress
FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for feature_tours
CREATE POLICY "Admins can manage feature tours" ON public.feature_tours
FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their relevant feature tours" ON public.feature_tours
FOR SELECT USING (
  is_active = true AND (
    (has_role(auth.uid(), 'Admin'::app_role)) OR
    (has_role(auth.uid(), 'Landlord'::app_role) AND 'Landlord' = ANY(user_roles)) OR
    (EXISTS(SELECT 1 FROM tenants WHERE user_id = auth.uid()) AND 'Tenant' = ANY(user_roles))
  )
);

-- Create RLS policies for user_tour_progress
CREATE POLICY "Users can manage their own tour progress" ON public.user_tour_progress
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tour progress" ON public.user_tour_progress
FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create RLS policies for trial_usage_tracking
CREATE POLICY "Users can manage their own trial usage" ON public.trial_usage_tracking
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all trial usage" ON public.trial_usage_tracking
FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_trial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_trial_configurations_updated_at
  BEFORE UPDATE ON public.trial_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_onboarding_steps_updated_at
  BEFORE UPDATE ON public.onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_feature_tours_updated_at
  BEFORE UPDATE ON public.feature_tours
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_user_tour_progress_updated_at
  BEFORE UPDATE ON public.user_tour_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

CREATE TRIGGER update_trial_usage_tracking_updated_at
  BEFORE UPDATE ON public.trial_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_trial_updated_at();

-- Insert default onboarding steps
INSERT INTO public.onboarding_steps (step_name, step_order, title, description, component_name, user_roles) VALUES
('welcome', 1, 'Welcome to the Platform', 'Get started with your property management journey', 'WelcomeStep', ARRAY['Landlord']),
('profile_setup', 2, 'Complete Your Profile', 'Add your basic information and preferences', 'ProfileSetupStep', ARRAY['Landlord']),
('add_first_property', 3, 'Add Your First Property', 'Create your first property listing', 'AddPropertyStep', ARRAY['Landlord']),
('add_units', 4, 'Add Units to Property', 'Set up units within your property', 'AddUnitsStep', ARRAY['Landlord']),
('payment_setup', 5, 'Configure Payment Methods', 'Set up how you want to receive payments', 'PaymentSetupStep', ARRAY['Landlord']),
('invite_tenants', 6, 'Invite Your First Tenant', 'Learn how to add and manage tenants', 'InviteTenantsStep', ARRAY['Landlord']),
('explore_features', 7, 'Explore Key Features', 'Discover the main features of the platform', 'ExploreFeaturesStep', ARRAY['Landlord']);

-- Insert default feature tours
INSERT INTO public.feature_tours (tour_name, title, description, target_page, user_roles, steps) VALUES
('dashboard_tour', 'Dashboard Overview', 'Learn about your main dashboard and key metrics', '/', ARRAY['Landlord'], 
'[
  {"target": ".stats-cards", "title": "Key Statistics", "content": "View your property portfolio overview here"},
  {"target": ".recent-activity", "title": "Recent Activity", "content": "Keep track of recent payments and maintenance requests"},
  {"target": ".quick-actions", "title": "Quick Actions", "content": "Access common tasks quickly from here"}
]'::jsonb),
('properties_tour', 'Property Management', 'Discover how to manage your properties effectively', '/properties', ARRAY['Landlord'],
'[
  {"target": ".add-property-button", "title": "Add Properties", "content": "Click here to add new properties to your portfolio"},
  {"target": ".property-list", "title": "Property List", "content": "View and manage all your properties from this list"},
  {"target": ".property-filters", "title": "Filter Options", "content": "Use filters to quickly find specific properties"}
]'::jsonb),
('tenants_tour', 'Tenant Management', 'Learn how to manage your tenants and leases', '/tenants', ARRAY['Landlord'],
'[
  {"target": ".add-tenant-button", "title": "Add Tenants", "content": "Add new tenants and create lease agreements"},
  {"target": ".tenant-list", "title": "Tenant Directory", "content": "View all your tenants and their lease information"},
  {"target": ".tenant-actions", "title": "Tenant Actions", "content": "Manage payments, maintenance requests, and communications"}
]'::jsonb);

-- Insert default trial configuration
INSERT INTO public.trial_configurations (billing_plan_id, trial_duration_days, features_enabled, limitations)
SELECT 
  id,
  30,
  '["property_management", "tenant_management", "basic_reporting", "payment_tracking"]'::jsonb,
  '{"max_properties": 2, "max_units": 10, "max_tenants": 10, "max_monthly_reports": 3}'::jsonb
FROM public.billing_plans 
WHERE name ILIKE '%trial%' OR name ILIKE '%free%'
LIMIT 1;