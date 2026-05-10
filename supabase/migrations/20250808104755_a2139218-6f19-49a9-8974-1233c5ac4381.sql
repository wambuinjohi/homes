-- Create centralized PDF templates and branding tables
-- 1) pdf_templates
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('invoice','report','letter','notice','lease','receipt','statement','demand_letter')),
  description text,
  content jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage pdf templates" ON public.pdf_templates
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'Admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Stakeholders can view active templates" ON public.pdf_templates
  FOR SELECT TO authenticated USING (
    is_active = true AND (
      has_role(auth.uid(), 'Landlord'::app_role) OR has_role(auth.uid(), 'Manager'::app_role) OR has_role(auth.uid(), 'Agent'::app_role) OR has_role(auth.uid(), 'Admin'::app_role)
    )
  );

-- 2) branding_profiles (platform and landlord-level branding)
CREATE TABLE IF NOT EXISTS public.branding_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','landlord')),
  landlord_id uuid,
  company_name text NOT NULL,
  company_tagline text,
  company_address text,
  company_phone text,
  company_email text,
  logo_url text,
  colors jsonb,
  footer_text text,
  website_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branding_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage branding" ON public.branding_profiles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'Admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords manage their branding" ON public.branding_profiles
  FOR ALL TO authenticated USING (scope = 'landlord' AND landlord_id = auth.uid()) WITH CHECK (scope = 'landlord' AND landlord_id = auth.uid());

CREATE POLICY "Stakeholders can view default platform branding" ON public.branding_profiles
  FOR SELECT TO authenticated USING (scope = 'platform' AND is_default = true);

-- 3) pdf_template_bindings (which template to use per document type/role/landlord)
CREATE TABLE IF NOT EXISTS public.pdf_template_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.pdf_templates(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('invoice','report','letter','notice','lease','receipt','statement','demand_letter')),
  role text NOT NULL CHECK (role IN ('Admin','Landlord','Manager','Agent','Tenant')),
  landlord_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_template_bindings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage bindings" ON public.pdf_template_bindings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'Admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords manage their bindings" ON public.pdf_template_bindings
  FOR ALL TO authenticated USING ((landlord_id IS NOT NULL) AND landlord_id = auth.uid()) WITH CHECK ((landlord_id IS NOT NULL) AND landlord_id = auth.uid());

CREATE POLICY "Stakeholders can view active bindings" ON public.pdf_template_bindings
  FOR SELECT TO authenticated USING (
    is_active = true AND (
      landlord_id IS NULL OR landlord_id = auth.uid()
    )
  );

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_pdf_template_bindings_lookup ON public.pdf_template_bindings (document_type, role, landlord_id, is_active, priority);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_on_pdf_templates ON public.pdf_templates;
CREATE TRIGGER set_timestamp_on_pdf_templates
BEFORE UPDATE ON public.pdf_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_on_branding_profiles ON public.branding_profiles;
CREATE TRIGGER set_timestamp_on_branding_profiles
BEFORE UPDATE ON public.branding_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_on_pdf_template_bindings ON public.pdf_template_bindings;
CREATE TRIGGER set_timestamp_on_pdf_template_bindings
BEFORE UPDATE ON public.pdf_template_bindings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a default platform branding row if none exists
INSERT INTO public.branding_profiles (scope, company_name, company_tagline, company_address, company_phone, company_email, logo_url, colors, footer_text, website_url, is_default)
SELECT 'platform', 'Zira Technologies', 'Professional Property Management Solutions', 'P.O. Box 1234, Nairobi, Kenya', '+254 700 000 000', 'info@ziratechnologies.com', '/src/assets/zira-logo.png',
       jsonb_build_object('primary', '#1B365D', 'secondary', '#64748B', 'accent', '#F36F21', 'neutral', '#F8F9FB'),
       'Powered by Zira Technologies - Transforming Property Management', 'www.ziratechnologies.com', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.branding_profiles WHERE scope = 'platform' AND is_default = true
);
