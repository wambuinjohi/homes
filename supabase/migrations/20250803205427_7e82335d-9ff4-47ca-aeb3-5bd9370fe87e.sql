-- Create knowledge_base_articles table for article management
CREATE TABLE public.knowledge_base_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  user_roles TEXT[] DEFAULT '{}', -- Array of roles that can view this article
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published, archived
  slug TEXT UNIQUE,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all articles" 
ON public.knowledge_base_articles 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view published articles for their role" 
ON public.knowledge_base_articles 
FOR SELECT 
USING (
  status = 'published' AND (
    user_roles = '{}' OR -- No role restriction
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role::text = ANY(user_roles)
    )
  )
);

-- Create SMS provider configurations table
CREATE TABLE public.sms_provider_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  sender_id TEXT,
  base_url TEXT,
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  config_data JSONB DEFAULT '{}', -- For provider-specific settings
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_provider_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage SMS provider configs" 
ON public.sms_provider_configs 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_knowledge_base_articles_updated_at
BEFORE UPDATE ON public.knowledge_base_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_provider_configs_updated_at
BEFORE UPDATE ON public.sms_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_knowledge_base_articles_status ON public.knowledge_base_articles(status);
CREATE INDEX idx_knowledge_base_articles_category ON public.knowledge_base_articles(category);
CREATE INDEX idx_knowledge_base_articles_user_roles ON public.knowledge_base_articles USING GIN(user_roles);
CREATE INDEX idx_sms_provider_configs_active ON public.sms_provider_configs(is_active);
CREATE INDEX idx_sms_provider_configs_default ON public.sms_provider_configs(is_default);