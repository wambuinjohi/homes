-- Add missing invoice_id field to payments table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'payments' AND column_name = 'invoice_id') THEN
    ALTER TABLE public.payments ADD COLUMN invoice_id UUID REFERENCES public.invoices(id);
  END IF;
END $$;