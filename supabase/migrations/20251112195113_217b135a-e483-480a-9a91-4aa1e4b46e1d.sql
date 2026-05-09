-- Create table to track overdue invoice reminders
CREATE TABLE IF NOT EXISTS public.invoice_overdue_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('3_days', '7_days', '14_days')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sms_status TEXT CHECK (sms_status IN ('sent', 'failed', 'pending')),
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, reminder_type)
);

-- Add index for efficient querying
CREATE INDEX idx_invoice_reminders_invoice_id ON public.invoice_overdue_reminders(invoice_id);
CREATE INDEX idx_invoice_reminders_sent_at ON public.invoice_overdue_reminders(sent_at);

-- Enable RLS
ALTER TABLE public.invoice_overdue_reminders ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for landlords to view their reminders
CREATE POLICY "Landlords can view reminders for their invoices"
ON public.invoice_overdue_reminders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.leases l ON i.lease_id = l.id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE i.id = invoice_overdue_reminders.invoice_id
    AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'Admin'::public.app_role)
);

COMMENT ON TABLE public.invoice_overdue_reminders IS 'Tracks automated SMS reminders sent for overdue invoices';