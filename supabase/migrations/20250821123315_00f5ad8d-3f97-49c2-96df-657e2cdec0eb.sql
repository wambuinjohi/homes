-- Step 2: Create trigger function to auto-link payments to invoices
CREATE OR REPLACE FUNCTION public.auto_link_payment_to_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if invoice_id is null but invoice_number exists
  IF NEW.invoice_id IS NULL AND NEW.invoice_number IS NOT NULL THEN
    -- Find matching invoice by invoice_number and tenant_id
    UPDATE public.payments 
    SET invoice_id = (
      SELECT inv.id 
      FROM public.invoices inv 
      WHERE inv.invoice_number = NEW.invoice_number 
        AND inv.tenant_id = NEW.tenant_id
      LIMIT 1
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger for auto-linking payments
DROP TRIGGER IF EXISTS trigger_auto_link_payment_to_invoice ON public.payments;
CREATE TRIGGER trigger_auto_link_payment_to_invoice
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_payment_to_invoice();

-- Step 3: Create function to sync invoice status based on payments
CREATE OR REPLACE FUNCTION public.sync_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_amount numeric;
  v_total_payments numeric;
  v_new_status text;
BEGIN
  -- Get invoice_id from the payment
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get invoice amount
  SELECT amount INTO v_invoice_amount
  FROM public.invoices
  WHERE id = v_invoice_id;
  
  -- Calculate total completed payments for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
  FROM public.payments
  WHERE invoice_id = v_invoice_id AND status = 'completed';
  
  -- Determine new status
  IF v_total_payments >= v_invoice_amount THEN
    v_new_status := 'paid';
  ELSIF v_total_payments > 0 THEN
    v_new_status := 'partial';
  ELSE
    -- Check if overdue
    SELECT CASE 
      WHEN due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END INTO v_new_status
    FROM public.invoices
    WHERE id = v_invoice_id;
  END IF;
  
  -- Update invoice status
  UPDATE public.invoices
  SET status = v_new_status, updated_at = now()
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger for syncing invoice status
DROP TRIGGER IF EXISTS trigger_sync_invoice_status ON public.payments;
CREATE TRIGGER trigger_sync_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_invoice_status();