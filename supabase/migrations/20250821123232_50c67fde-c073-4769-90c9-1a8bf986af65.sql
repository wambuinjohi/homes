-- Fix the existing notification trigger type issue first
CREATE OR REPLACE FUNCTION public.create_invoice_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account
  IF tenant_user_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      notification_title := 'New Invoice';
      notification_message := 'A new invoice #' || NEW.invoice_number || ' for ' || NEW.amount || ' has been generated.';
    ELSIF OLD.status != NEW.status THEN
      notification_title := 'Invoice Status Update';
      notification_message := 'Invoice #' || NEW.invoice_number || ' status has been updated to ' || NEW.status || '.';
    ELSE
      RETURN NEW; -- No notification needed
    END IF;
    
    -- Insert notification with proper UUID casting
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id::uuid, 
      'invoice'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now run the main integrity fixes
-- Step 1: Add foreign key constraints (NOT VALID initially to avoid blocking)
ALTER TABLE public.payments 
ADD CONSTRAINT fk_payments_lease_id 
FOREIGN KEY (lease_id) REFERENCES public.leases(id) NOT VALID;

ALTER TABLE public.payments 
ADD CONSTRAINT fk_payments_tenant_id 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;

ALTER TABLE public.payments 
ADD CONSTRAINT fk_payments_invoice_id 
FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) NOT VALID;

ALTER TABLE public.invoices 
ADD CONSTRAINT fk_invoices_lease_id 
FOREIGN KEY (lease_id) REFERENCES public.leases(id) NOT VALID;

ALTER TABLE public.invoices 
ADD CONSTRAINT fk_invoices_tenant_id 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;

ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_property_id 
FOREIGN KEY (property_id) REFERENCES public.properties(id) NOT VALID;

ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_unit_id 
FOREIGN KEY (unit_id) REFERENCES public.units(id) NOT VALID;

ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_tenant_id 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;

ALTER TABLE public.leases 
ADD CONSTRAINT fk_leases_unit_id 
FOREIGN KEY (unit_id) REFERENCES public.units(id) NOT VALID;

ALTER TABLE public.leases 
ADD CONSTRAINT fk_leases_tenant_id 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) NOT VALID;

ALTER TABLE public.units 
ADD CONSTRAINT fk_units_property_id 
FOREIGN KEY (property_id) REFERENCES public.properties(id) NOT VALID;