-- Create billing_plan_audit table for tracking plan changes
CREATE TABLE IF NOT EXISTS public.billing_plan_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  changes JSONB,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_plan_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view billing plan audit logs"
ON public.billing_plan_audit
FOR SELECT
USING (
  has_role(auth.uid(), 'Admin'::app_role)
);

-- Create index for faster queries
CREATE INDEX idx_billing_plan_audit_plan_id ON public.billing_plan_audit(billing_plan_id);
CREATE INDEX idx_billing_plan_audit_created_at ON public.billing_plan_audit(created_at DESC);

-- Function to log plan changes
CREATE OR REPLACE FUNCTION public.log_billing_plan_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  action_type TEXT;
  old_data JSONB;
  new_data JSONB;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    action_type := 'created';
    new_data := to_jsonb(NEW);
    INSERT INTO public.billing_plan_audit (billing_plan_id, changed_by, action, new_values)
    VALUES (NEW.id, current_user_id, action_type, new_data);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'updated';
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    INSERT INTO public.billing_plan_audit (billing_plan_id, changed_by, action, old_values, new_values)
    VALUES (NEW.id, current_user_id, action_type, old_data, new_data);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'deleted';
    old_data := to_jsonb(OLD);
    INSERT INTO public.billing_plan_audit (billing_plan_id, changed_by, action, old_values)
    VALUES (OLD.id, current_user_id, action_type, old_data);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic audit logging
CREATE TRIGGER billing_plan_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.log_billing_plan_change();