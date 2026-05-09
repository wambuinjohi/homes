-- Create invoice_number_seq if it does not exist and initialize it based on existing invoices
-- Safe to run multiple times

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND c.relname = 'invoice_number_seq' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE SEQUENCE public.invoice_number_seq INCREMENT BY 1 MINVALUE 1 START WITH 1 CACHE 1';
  END IF;
END
$$;

-- Initialize the sequence to the highest existing numeric suffix of invoice_number (e.g., INV-2024-000123 -> 123)
-- Next nextval() call will return max + 1
SELECT setval(
  'public.invoice_number_seq',
  GREATEST(
    COALESCE((
      SELECT MAX((regexp_match(invoice_number, '([0-9]+)$'))[1]::BIGINT)
      FROM public.invoices
      WHERE invoice_number IS NOT NULL
    ), 0),
    0
  )
);

-- Ensure default uses the generator function (idempotent)
ALTER TABLE public.invoices 
  ALTER COLUMN invoice_number SET DEFAULT public.generate_invoice_number();

-- Optional: keep a unique constraint/index on invoice_number to avoid duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.invoices'::regclass 
      AND contype = 'u' AND conname = 'invoices_invoice_number_key'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);
  END IF;
END
$$;
