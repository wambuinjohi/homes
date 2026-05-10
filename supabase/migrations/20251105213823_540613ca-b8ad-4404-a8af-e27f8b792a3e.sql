-- Fix notification trigger type mismatch errors
-- Remove ::text casts from UUID fields being inserted into related_id

-- Fix create_maintenance_notification
CREATE OR REPLACE FUNCTION public.create_maintenance_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  IF tenant_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.status != NEW.status) THEN
    notification_title := 'Maintenance Request Update';
    
    IF TG_OP = 'INSERT' THEN
      notification_message := 'Your maintenance request "' || NEW.title || '" has been received and is being reviewed.';
    ELSE
      notification_message := 'Your maintenance request "' || NEW.title || '" status has been updated to ' || NEW.status || '.';
    END IF;
    
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'maintenance', 
      NEW.id,
      'maintenance_request'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix create_payment_notification
CREATE OR REPLACE FUNCTION public.create_payment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  IF tenant_user_id IS NOT NULL THEN
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
    
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id,
      'payment'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix create_lease_expiration_notification
CREATE OR REPLACE FUNCTION public.create_lease_expiration_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  tenant_user_id UUID;
  days_until_expiry INTEGER;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  days_until_expiry := NEW.lease_end_date - CURRENT_DATE;
  
  IF tenant_user_id IS NOT NULL AND days_until_expiry <= 30 AND days_until_expiry > 0 THEN
    IF days_until_expiry <= 7 THEN
      notification_title := 'Lease Expiring Soon';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Please contact your landlord to discuss renewal.';
    ELSIF days_until_expiry <= 30 THEN
      notification_title := 'Lease Renewal Reminder';
      notification_message := 'Your lease expires in ' || days_until_expiry || ' days. Consider discussing renewal options with your landlord.';
    END IF;
    
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'lease', 
      NEW.id,
      'lease'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix create_invoice_notification
CREATE OR REPLACE FUNCTION public.create_invoice_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  tenant_user_id UUID;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  SELECT t.user_id INTO tenant_user_id
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;
  
  IF tenant_user_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      notification_title := 'New Invoice';
      notification_message := 'A new invoice #' || NEW.invoice_number || ' for ' || NEW.amount || ' has been generated.';
    ELSIF OLD.status != NEW.status THEN
      notification_title := 'Invoice Status Update';
      notification_message := 'Invoice #' || NEW.invoice_number || ' status has been updated to ' || NEW.status || '.';
    ELSE
      RETURN NEW;
    END IF;
    
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, related_type
    ) VALUES (
      tenant_user_id, 
      notification_title, 
      notification_message, 
      'payment', 
      NEW.id,
      'invoice'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;