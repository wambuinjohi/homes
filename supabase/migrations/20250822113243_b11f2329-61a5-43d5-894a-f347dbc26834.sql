-- Create unit type preferences table for landlords to enable/disable unit types
CREATE TABLE public.unit_type_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  unit_type_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(landlord_id, unit_type_id)
);

-- Enable RLS
ALTER TABLE public.unit_type_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Landlords can manage their own unit type preferences"
ON public.unit_type_preferences
FOR ALL
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Admins can manage all unit type preferences"
ON public.unit_type_preferences
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_unit_type_preferences_updated_at
BEFORE UPDATE ON public.unit_type_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();