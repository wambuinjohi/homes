-- Enhanced Landlord Maintenance Dashboard Schema
-- Add tables for service providers, internal notes, action logs, and notifications

-- Service providers table
CREATE TABLE IF NOT EXISTS public.service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialties TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Internal notes/comments for maintenance requests
CREATE TABLE IF NOT EXISTS public.maintenance_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Action logs for maintenance requests
CREATE TABLE IF NOT EXISTS public.maintenance_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'status_change', 'assignment', 'note_added', 'created', 'resolved'
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notification preferences and logs
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  portal_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  maintenance_request_id UUID REFERENCES public.maintenance_requests(id),
  notification_type TEXT NOT NULL, -- 'email', 'sms', 'portal'
  status TEXT NOT NULL, -- 'sent', 'failed', 'pending'
  subject TEXT,
  message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add new columns to maintenance_requests table
ALTER TABLE public.maintenance_requests 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.service_providers(id),
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS last_updated_by UUID,
ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS on new tables
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_providers
CREATE POLICY "Property stakeholders can manage service providers" 
ON public.service_providers FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role));

-- RLS policies for maintenance_notes
CREATE POLICY "Property stakeholders can manage maintenance notes" 
ON public.maintenance_notes FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.maintenance_requests mr
    JOIN public.properties p ON p.id = mr.property_id
    WHERE mr.id = maintenance_notes.maintenance_request_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role))
  )
);

-- RLS policies for maintenance_action_logs
CREATE POLICY "Property stakeholders can view action logs" 
ON public.maintenance_action_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.maintenance_requests mr
    JOIN public.properties p ON p.id = mr.property_id
    WHERE mr.id = maintenance_action_logs.maintenance_request_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role))
  )
);

CREATE POLICY "System can insert action logs" 
ON public.maintenance_action_logs FOR INSERT 
WITH CHECK (true);

-- RLS policies for notification_preferences
CREATE POLICY "Users can manage their notification preferences" 
ON public.notification_preferences FOR ALL 
USING (auth.uid() = user_id);

-- RLS policies for notification_logs
CREATE POLICY "Users can view their notification logs" 
ON public.notification_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notification logs" 
ON public.notification_logs FOR INSERT 
WITH CHECK (true);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_service_providers_updated_at
  BEFORE UPDATE ON public.service_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log maintenance actions
CREATE OR REPLACE FUNCTION public.log_maintenance_action(
  _maintenance_request_id UUID,
  _user_id UUID,
  _action_type TEXT,
  _old_value TEXT DEFAULT NULL,
  _new_value TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.maintenance_action_logs (
    maintenance_request_id, user_id, action_type, old_value, new_value, details
  ) VALUES (
    _maintenance_request_id, _user_id, _action_type, _old_value, _new_value, _details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;