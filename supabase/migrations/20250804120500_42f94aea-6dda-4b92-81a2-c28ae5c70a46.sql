-- Create M-Pesa transactions table
CREATE TABLE public.mpesa_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_request_id TEXT NOT NULL UNIQUE,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  result_code INTEGER,
  result_desc TEXT,
  mpesa_receipt_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for M-Pesa transactions
CREATE POLICY "Users can view their own transactions" 
ON public.mpesa_transactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    JOIN public.tenants ON invoices.tenant_id = tenants.id 
    WHERE invoices.id = mpesa_transactions.invoice_id 
    AND tenants.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert transactions" 
ON public.mpesa_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update transactions" 
ON public.mpesa_transactions 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mpesa_transactions_updated_at
BEFORE UPDATE ON public.mpesa_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_mpesa_transactions_checkout_request_id ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_invoice_id ON public.mpesa_transactions(invoice_id);
CREATE INDEX idx_mpesa_transactions_status ON public.mpesa_transactions(status);