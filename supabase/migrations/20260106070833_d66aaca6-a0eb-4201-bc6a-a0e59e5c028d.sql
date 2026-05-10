-- Create partner_logos table for admin-managed company logos on landing page
CREATE TABLE public.partner_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  website_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.partner_logos ENABLE ROW LEVEL SECURITY;

-- Public can view active logos (for landing page)
CREATE POLICY "Anyone can view active partner logos"
ON public.partner_logos
FOR SELECT
USING (is_active = true);

-- Only admins can manage partner logos
CREATE POLICY "Admins can manage partner logos"
ON public.partner_logos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'Admin'
  )
);

-- Add system setting for showing partner logos section
INSERT INTO public.billing_settings (setting_key, setting_value, description)
VALUES ('show_partner_logos', 'false', 'Toggle to show/hide partner logos section on landing page')
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_partner_logos_updated_at
BEFORE UPDATE ON public.partner_logos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();