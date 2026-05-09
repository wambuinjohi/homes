-- Create meter readings table for tracking utility consumption
CREATE TABLE public.meter_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL,
  meter_type TEXT NOT NULL, -- 'electricity', 'water', 'gas', etc.
  previous_reading NUMERIC NOT NULL DEFAULT 0,
  current_reading NUMERIC NOT NULL,
  reading_date DATE NOT NULL,
  rate_per_unit NUMERIC NOT NULL DEFAULT 0, -- cost per unit consumed
  units_consumed NUMERIC GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
  total_cost NUMERIC GENERATED ALWAYS AS ((current_reading - previous_reading) * rate_per_unit) STORED,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add expense_type to expenses table to differentiate between one-time and metered expenses
ALTER TABLE public.expenses ADD COLUMN expense_type TEXT NOT NULL DEFAULT 'one-time';
ALTER TABLE public.expenses ADD COLUMN meter_reading_id UUID;
ALTER TABLE public.expenses ADD COLUMN tenant_id UUID;
ALTER TABLE public.expenses ADD COLUMN is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN recurrence_period TEXT; -- 'monthly', 'quarterly', 'yearly'

-- Add constraint for expense_type
ALTER TABLE public.expenses ADD CONSTRAINT expense_type_check 
CHECK (expense_type IN ('one-time', 'metered', 'recurring'));

-- Enable RLS on meter_readings
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

-- Create policies for meter_readings
CREATE POLICY "Property stakeholders can manage meter readings" 
ON public.meter_readings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE u.id = meter_readings.unit_id 
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ) OR has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role)
);

-- Create function to update meter_readings updated_at
CREATE OR REPLACE FUNCTION public.update_meter_readings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for meter_readings
CREATE TRIGGER update_meter_readings_updated_at
BEFORE UPDATE ON public.meter_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_meter_readings_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_meter_readings_unit_id ON public.meter_readings(unit_id);
CREATE INDEX idx_meter_readings_meter_type ON public.meter_readings(meter_type);
CREATE INDEX idx_meter_readings_reading_date ON public.meter_readings(reading_date);
CREATE INDEX idx_expenses_type ON public.expenses(expense_type);
CREATE INDEX idx_expenses_tenant_id ON public.expenses(tenant_id);