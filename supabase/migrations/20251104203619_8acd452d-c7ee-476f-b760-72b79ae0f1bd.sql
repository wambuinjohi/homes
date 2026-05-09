-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create SMS campaigns table for tracking bulk SMS campaigns
CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  successful_sends INTEGER DEFAULT 0,
  failed_sends INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 2) DEFAULT 0,
  actual_cost DECIMAL(10, 2) DEFAULT 0,
  filter_criteria JSONB,
  template_id UUID REFERENCES public.sms_templates(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin can manage all campaigns
CREATE POLICY "Admins can manage SMS campaigns"
ON public.sms_campaigns
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'Admin'));

-- Create indexes for performance
CREATE INDEX idx_sms_campaigns_created_by ON public.sms_campaigns(created_by);
CREATE INDEX idx_sms_campaigns_status ON public.sms_campaigns(status);
CREATE INDEX idx_sms_campaigns_created_at ON public.sms_campaigns(created_at DESC);