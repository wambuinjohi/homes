-- Create payment_allocations table for tracking payment-to-invoice allocations
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  allocated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON public.payment_allocations(invoice_id);

-- Add updated_at trigger
CREATE TRIGGER update_payment_allocations_updated_at
  BEFORE UPDATE ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies for payment_allocations
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property owners can manage their payment allocations" ON public.payment_allocations
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.leases l ON inv.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE inv.id = payment_allocations.invoice_id
      AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  ) OR has_role(auth.uid(), 'Admin'::public.app_role)
);

CREATE POLICY "Tenants can view their payment allocations" ON public.payment_allocations
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices inv
    JOIN public.tenants t ON inv.tenant_id = t.id
    WHERE inv.id = payment_allocations.invoice_id
      AND t.user_id = auth.uid()
  )
);

-- Create reconciliation function
CREATE OR REPLACE FUNCTION public.reconcile_unallocated_payments_for_tenant(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payment_record record;
  v_invoice_record record;
  v_allocations_created integer := 0;
  v_total_allocated numeric := 0;
BEGIN
  -- Get unallocated payments for this tenant
  FOR v_payment_record IN
    SELECT 
      p.id,
      p.amount,
      p.payment_date,
      p.amount - COALESCE(allocated.total_allocated, 0) as unallocated_amount
    FROM public.payments p
    LEFT JOIN (
      SELECT 
        payment_id,
        SUM(amount) as total_allocated
      FROM public.payment_allocations
      GROUP BY payment_id
    ) allocated ON p.id = allocated.payment_id
    WHERE p.tenant_id = p_tenant_id
      AND p.status IN ('completed', 'paid', 'success')
      AND (p.amount - COALESCE(allocated.total_allocated, 0)) > 0
    ORDER BY p.payment_date ASC
  LOOP
    -- Find unpaid invoices for this tenant (oldest first)
    FOR v_invoice_record IN
      SELECT 
        i.id,
        i.amount,
        i.due_date,
        i.amount - COALESCE(allocated.total_allocated, 0) as unallocated_amount
      FROM public.invoices i
      LEFT JOIN (
        SELECT 
          invoice_id,
          SUM(amount) as total_allocated
        FROM public.payment_allocations
        GROUP BY invoice_id
      ) allocated ON i.id = allocated.invoice_id
      WHERE i.tenant_id = p_tenant_id
        AND (i.amount - COALESCE(allocated.total_allocated, 0)) > 0
      ORDER BY i.due_date ASC
    LOOP
      -- Allocate payment to invoice (partial or full)
      DECLARE
        v_allocation_amount numeric;
      BEGIN
        v_allocation_amount := LEAST(v_payment_record.unallocated_amount, v_invoice_record.unallocated_amount);
        
        -- Insert allocation
        INSERT INTO public.payment_allocations (payment_id, invoice_id, amount)
        VALUES (v_payment_record.id, v_invoice_record.id, v_allocation_amount);
        
        v_allocations_created := v_allocations_created + 1;
        v_total_allocated := v_total_allocated + v_allocation_amount;
        
        -- Update remaining amounts
        v_payment_record.unallocated_amount := v_payment_record.unallocated_amount - v_allocation_amount;
        v_invoice_record.unallocated_amount := v_invoice_record.unallocated_amount - v_allocation_amount;
        
        -- Exit if payment is fully allocated
        EXIT WHEN v_payment_record.unallocated_amount <= 0;
      END;
    END LOOP;
    
    -- Exit if no more unallocated amount in payment
    EXIT WHEN v_payment_record.unallocated_amount <= 0;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'allocations_created', v_allocations_created,
    'total_allocated', v_total_allocated
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'tenant_id', p_tenant_id
  );
END;
$function$;