-- Create tenant_credits table for tracking overpayments/credits
CREATE TABLE public.tenant_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0),
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'overpayment', -- 'overpayment', 'refund', 'adjustment', 'manual'
  source_payment_id UUID REFERENCES public.payments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create credit_applications table to track when credits are applied to invoices
CREATE TABLE public.credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.tenant_credits(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  applied_at TIMESTAMPTZ DEFAULT now(),
  applied_by UUID,
  notes TEXT
);

-- Enable RLS on both tables
ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_credits
CREATE POLICY "Landlords can manage credits for their tenants"
ON public.tenant_credits FOR ALL
USING (
  landlord_id = auth.uid() OR 
  has_role(auth.uid(), 'Admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.leases l ON l.tenant_id = t.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE t.id = tenant_credits.tenant_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
)
WITH CHECK (
  landlord_id = auth.uid() OR 
  has_role(auth.uid(), 'Admin'::app_role)
);

CREATE POLICY "Tenants can view their own credits"
ON public.tenant_credits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_credits.tenant_id AND t.user_id = auth.uid()
  )
);

-- RLS policies for credit_applications
CREATE POLICY "Landlords can manage credit applications"
ON public.credit_applications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_credits tc
    WHERE tc.id = credit_applications.credit_id
    AND (tc.landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_credits tc
    WHERE tc.id = credit_applications.credit_id
    AND (tc.landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  )
);

CREATE POLICY "Tenants can view their credit applications"
ON public.credit_applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_credits tc
    JOIN public.tenants t ON t.id = tc.tenant_id
    WHERE tc.id = credit_applications.credit_id AND t.user_id = auth.uid()
  )
);

-- Create trigger function to auto-update invoice status based on payment allocations
CREATE OR REPLACE FUNCTION public.update_invoice_status_on_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_total_allocated NUMERIC;
  v_invoice_amount NUMERIC;
  v_invoice_status TEXT;
BEGIN
  -- Calculate total allocated for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_allocated
  FROM public.payment_allocations 
  WHERE invoice_id = NEW.invoice_id;
  
  -- Get invoice amount and current status
  SELECT amount, status INTO v_invoice_amount, v_invoice_status
  FROM public.invoices 
  WHERE id = NEW.invoice_id;
  
  -- Update invoice status based on allocation
  IF v_total_allocated >= v_invoice_amount THEN
    -- Fully paid
    UPDATE public.invoices 
    SET status = 'paid', updated_at = now() 
    WHERE id = NEW.invoice_id AND status != 'paid';
  ELSIF v_total_allocated > 0 THEN
    -- Partially paid
    UPDATE public.invoices 
    SET status = 'partially_paid', updated_at = now() 
    WHERE id = NEW.invoice_id AND status NOT IN ('paid', 'partially_paid');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on payment_allocations
DROP TRIGGER IF EXISTS trigger_update_invoice_status ON public.payment_allocations;
CREATE TRIGGER trigger_update_invoice_status
AFTER INSERT OR UPDATE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_status_on_allocation();

-- Create function to get tenant credit balance
CREATE OR REPLACE FUNCTION public.get_tenant_credit_balance(p_tenant_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(balance) FROM public.tenant_credits WHERE tenant_id = p_tenant_id AND balance > 0),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Create function to apply credit to invoice
CREATE OR REPLACE FUNCTION public.apply_credit_to_invoice(
  p_credit_id UUID,
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_applied_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_credit_balance NUMERIC;
  v_invoice_outstanding NUMERIC;
  v_apply_amount NUMERIC;
BEGIN
  -- Get credit balance
  SELECT balance INTO v_credit_balance
  FROM public.tenant_credits WHERE id = p_credit_id;
  
  IF v_credit_balance IS NULL OR v_credit_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit balance available');
  END IF;
  
  -- Calculate outstanding amount for invoice
  SELECT i.amount - COALESCE(SUM(pa.amount), 0) INTO v_invoice_outstanding
  FROM public.invoices i
  LEFT JOIN public.payment_allocations pa ON pa.invoice_id = i.id
  WHERE i.id = p_invoice_id
  GROUP BY i.id;
  
  IF v_invoice_outstanding IS NULL OR v_invoice_outstanding <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice has no outstanding balance');
  END IF;
  
  -- Determine amount to apply
  v_apply_amount := LEAST(p_amount, v_credit_balance, v_invoice_outstanding);
  
  -- Create credit application record
  INSERT INTO public.credit_applications (credit_id, invoice_id, amount, applied_by)
  VALUES (p_credit_id, p_invoice_id, v_apply_amount, COALESCE(p_applied_by, auth.uid()));
  
  -- Update credit balance
  UPDATE public.tenant_credits
  SET balance = balance - v_apply_amount, updated_at = now()
  WHERE id = p_credit_id;
  
  -- Update invoice status based on new payment
  IF v_invoice_outstanding - v_apply_amount <= 0 THEN
    UPDATE public.invoices SET status = 'paid', updated_at = now() WHERE id = p_invoice_id;
  ELSE
    UPDATE public.invoices SET status = 'partially_paid', updated_at = now() WHERE id = p_invoice_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'applied_amount', v_apply_amount,
    'remaining_credit', v_credit_balance - v_apply_amount,
    'remaining_outstanding', v_invoice_outstanding - v_apply_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add index for performance
CREATE INDEX idx_tenant_credits_tenant_id ON public.tenant_credits(tenant_id);
CREATE INDEX idx_tenant_credits_balance ON public.tenant_credits(balance) WHERE balance > 0;
CREATE INDEX idx_credit_applications_credit_id ON public.credit_applications(credit_id);
CREATE INDEX idx_credit_applications_invoice_id ON public.credit_applications(invoice_id);