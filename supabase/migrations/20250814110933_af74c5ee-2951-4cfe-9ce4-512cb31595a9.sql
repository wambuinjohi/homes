-- Security Fix: Add search_path protection to database functions
-- This prevents SQL injection attacks through search_path manipulation

-- Update create_payment_notification function
CREATE OR REPLACE FUNCTION public.create_payment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Update generate_invoice_number function
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    next_id bigint;
    invoice_number text;
BEGIN
    -- Get the next sequence value
    SELECT nextval('public.invoice_number_seq') INTO next_id;
    
    -- Generate invoice number with proper formatting
    invoice_number := 'INV-' || TO_CHAR(EXTRACT(YEAR FROM CURRENT_DATE), 'YYYY') || '-' || LPAD(next_id::text, 6, '0');
    
    RETURN invoice_number;
END;
$function$;

-- Update update_trial_updated_at function
CREATE OR REPLACE FUNCTION public.update_trial_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update create_maintenance_notification function
CREATE OR REPLACE FUNCTION public.create_maintenance_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
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
$function$;

-- Update create_lease_expiration_notification function
CREATE OR REPLACE FUNCTION public.create_lease_expiration_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  tenant_user_id UUID;
  days_until_expiry INTEGER;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the tenant's user_id
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
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
$function$;

-- Update create_invoice_notification function
CREATE OR REPLACE FUNCTION public.create_invoice_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;