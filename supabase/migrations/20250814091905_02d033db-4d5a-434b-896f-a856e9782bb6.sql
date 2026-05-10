-- Create database triggers for automatic notification generation

-- Function to create payment notifications
CREATE OR REPLACE FUNCTION create_payment_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account
  IF tenant_user_id IS NOT NULL THEN
    -- Set notification content based on payment status
    IF NEW.status = 'completed' THEN
      notification_title := 'Payment Received';
      notification_message := 'Your payment of ' || NEW.amount || ' has been successfully processed.';
    ELSIF NEW.status = 'pending' THEN
      notification_title := 'Payment Pending';
      notification_message := 'Your payment of ' || NEW.amount || ' is being processed.';
    ELSIF NEW.status = 'failed' THEN
      notification_title := 'Payment Failed';
      notification_message := 'Your payment of ' || NEW.amount || ' could not be processed. Please try again.';
    ELSE
      notification_title := 'Payment Status Update';
      notification_message := 'Your payment status has been updated to ' || NEW.status || '.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id::text, 
      'payment'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment notifications
DROP TRIGGER IF EXISTS payment_notification_trigger ON payments;
CREATE TRIGGER payment_notification_trigger
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_notification();

-- Function to create maintenance request notifications
CREATE OR REPLACE FUNCTION create_maintenance_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Only create notification if tenant has a user account and status changed
  IF tenant_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status != NEW.status) THEN
    notification_title := 'Maintenance Request Update';
    
    IF TG_OP = 'INSERT' THEN
      notification_message := 'Your maintenance request "' || NEW.title || '" has been received and is being reviewed.';
    ELSE
      notification_message := 'Your maintenance request "' || NEW.title || '" status has been updated to ' || NEW.status || '.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'maintenance', 
      NEW.id::text, 
      'maintenance_request'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintenance notifications
DROP TRIGGER IF EXISTS maintenance_notification_trigger ON maintenance_requests;
CREATE TRIGGER maintenance_notification_trigger
  AFTER INSERT OR UPDATE OF status ON maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_maintenance_notification();

-- Function to create lease expiration notifications
CREATE OR REPLACE FUNCTION create_lease_expiration_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  days_until_expiry INTEGER;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
  WHERE t.id = NEW.tenant_id;
  
  -- Calculate days until lease expiry
  days_until_expiry := NEW.lease_end_date - CURRENT_DATE;
  
  -- Only create notification if tenant has a user account and lease is expiring soon
  IF tenant_user_id IS NOT NULL AND days_until_expiry <= 30 AND days_until_expiry > 0 THEN
    IF days_until_expiry <= 7 THEN
      notification_title := 'Lease Expiring Soon';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Please contact your landlord to discuss renewal.';
    ELSIF days_until_expiry <= 30 THEN
      notification_title := 'Lease Renewal Reminder';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Consider discussing renewal options with your landlord.';
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'lease', 
      NEW.id::text, 
      'lease'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lease expiration notifications
DROP TRIGGER IF EXISTS lease_expiration_notification_trigger ON leases;
CREATE TRIGGER lease_expiration_notification_trigger
  AFTER INSERT OR UPDATE OF lease_end_date ON leases
  FOR EACH ROW
  EXECUTE FUNCTION create_lease_expiration_notification();

-- Function to create invoice notifications
CREATE OR REPLACE FUNCTION create_invoice_notification()
RETURNS TRIGGER AS $$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM tenants t
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
    
    -- Insert notification
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id::text, 
      'invoice'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice notifications
DROP TRIGGER IF EXISTS invoice_notification_trigger ON invoices;
CREATE TRIGGER invoice_notification_trigger
  AFTER INSERT OR UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_notification();