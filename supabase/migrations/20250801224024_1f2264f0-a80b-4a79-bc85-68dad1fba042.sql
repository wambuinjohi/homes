-- Add payment reference and invoice number to payments table
ALTER TABLE public.payments 
ADD COLUMN payment_reference TEXT,
ADD COLUMN invoice_number TEXT;

-- Create maintenance_requests table for tenant maintenance requests
CREATE TABLE public.maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  unit_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  category TEXT NOT NULL,
  submitted_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for maintenance requests
CREATE POLICY "Property stakeholders can manage maintenance requests" 
ON public.maintenance_requests 
FOR ALL 
USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = maintenance_requests.property_id) AND ((p.owner_id = auth.uid()) OR (p.manager_id = auth.uid()))))) OR has_role(auth.uid(), 'Admin'::app_role) OR has_role(auth.uid(), 'Landlord'::app_role));

CREATE POLICY "Tenants can create and view their own maintenance requests" 
ON public.maintenance_requests 
FOR ALL 
USING (EXISTS ( SELECT 1
   FROM tenants t
  WHERE ((t.id = maintenance_requests.tenant_id) AND (t.user_id = auth.uid()))));

-- Add trigger for maintenance requests timestamps
CREATE TRIGGER update_maintenance_requests_updated_at
BEFORE UPDATE ON public.maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();