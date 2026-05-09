-- Create bulk upload logs table for audit trail
CREATE TABLE public.bulk_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('tenant', 'unit', 'property')),
  file_name TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  successful_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bulk_upload_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all bulk upload logs" 
ON public.bulk_upload_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own bulk upload logs" 
ON public.bulk_upload_logs 
FOR SELECT 
USING (uploaded_by = auth.uid());

CREATE POLICY "Property stakeholders can insert bulk upload logs" 
ON public.bulk_upload_logs 
FOR INSERT 
WITH CHECK (
  uploaded_by = auth.uid() AND
  (has_role(auth.uid(), 'Admin'::app_role) OR 
   has_role(auth.uid(), 'Landlord'::app_role) OR 
   has_role(auth.uid(), 'Manager'::app_role) OR 
   has_role(auth.uid(), 'Agent'::app_role))
);

-- Create trigger for updated_at
CREATE TRIGGER update_bulk_upload_logs_updated_at
  BEFORE UPDATE ON public.bulk_upload_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_bulk_upload_logs_uploaded_by ON public.bulk_upload_logs(uploaded_by);
CREATE INDEX idx_bulk_upload_logs_operation_type ON public.bulk_upload_logs(operation_type);
CREATE INDEX idx_bulk_upload_logs_created_at ON public.bulk_upload_logs(created_at DESC);