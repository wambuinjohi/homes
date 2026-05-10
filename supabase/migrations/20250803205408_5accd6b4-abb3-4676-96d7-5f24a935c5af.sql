-- Add email logs table for tracking emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  template_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT DEFAULT 'supabase',
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email logs
CREATE POLICY "Admins can manage email logs" 
ON public.email_logs 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON public.email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON public.email_logs(template_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_logs_updated_at();

-- Add knowledge base articles table
CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  target_user_types TEXT[] DEFAULT ARRAY['Admin', 'Landlord', 'Tenant']::TEXT[],
  is_published BOOLEAN DEFAULT false,
  author_id UUID REFERENCES auth.users(id),
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for knowledge base
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for knowledge base
CREATE POLICY "Admins can manage articles" 
ON public.knowledge_base_articles 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view published articles for their user type"
ON public.knowledge_base_articles
FOR SELECT
USING (
  is_published = true AND (
    'Admin' = ANY(target_user_types) AND has_role(auth.uid(), 'Admin'::app_role) OR
    'Landlord' = ANY(target_user_types) AND has_role(auth.uid(), 'Landlord'::app_role) OR
    'Tenant' = ANY(target_user_types) AND EXISTS (
      SELECT 1 FROM tenants WHERE user_id = auth.uid()
    )
  )
);

-- Create trigger for knowledge base updated_at
CREATE TRIGGER update_knowledge_base_articles_updated_at
  BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_logs_updated_at();