-- Fix the incorrectly marked invoice status
-- The allocation trigger doesn't update if already 'paid', so we need to manually fix this
UPDATE public.invoices 
SET status = 'partially_paid', updated_at = now() 
WHERE id = '1bc4ceec-e45b-4eaf-ac67-a10a0571b60f';

-- Also improve the trigger to properly handle recalculation when allocations change
CREATE OR REPLACE FUNCTION public.update_invoice_status_on_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_total_allocated NUMERIC;
  v_invoice_amount NUMERIC;
BEGIN
  -- Calculate total allocated for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_allocated
  FROM public.payment_allocations 
  WHERE invoice_id = NEW.invoice_id;
  
  -- Get invoice amount
  SELECT amount INTO v_invoice_amount
  FROM public.invoices 
  WHERE id = NEW.invoice_id;
  
  -- Update invoice status based on allocation
  IF v_total_allocated >= v_invoice_amount THEN
    -- Fully paid
    UPDATE public.invoices 
    SET status = 'paid', updated_at = now() 
    WHERE id = NEW.invoice_id;
  ELSIF v_total_allocated > 0 THEN
    -- Partially paid
    UPDATE public.invoices 
    SET status = 'partially_paid', updated_at = now() 
    WHERE id = NEW.invoice_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;