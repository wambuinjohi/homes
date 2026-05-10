-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('technical', 'billing', 'general', 'maintenance')),
  user_id UUID NOT NULL,
  assigned_to UUID NULL,
  resolution_notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support_messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_staff_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system_logs table
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('error', 'warning', 'info')),
  message TEXT NOT NULL,
  service TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_tickets
CREATE POLICY "Users can view their own tickets" 
ON public.support_tickets 
FOR SELECT 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can create their own tickets" 
ON public.support_tickets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets" 
ON public.support_tickets 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Admins can manage all tickets" 
ON public.support_tickets 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- RLS policies for support_messages
CREATE POLICY "Users can view messages for their tickets" 
ON public.support_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = support_messages.ticket_id 
    AND (user_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  )
);

CREATE POLICY "Users can create messages for their tickets" 
ON public.support_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = support_messages.ticket_id 
    AND (user_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role))
  )
);

CREATE POLICY "Admins can manage all messages" 
ON public.support_messages 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

-- RLS policies for system_logs
CREATE POLICY "Admins can view system logs" 
ON public.system_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert logs" 
ON public.system_logs 
FOR INSERT 
WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX idx_system_logs_type ON public.system_logs(type);
CREATE INDEX idx_system_logs_service ON public.system_logs(service);
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at);

-- Create function to log system events
CREATE OR REPLACE FUNCTION public.log_system_event(
  _type TEXT,
  _message TEXT,
  _service TEXT,
  _metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  INSERT INTO public.system_logs (type, message, service, metadata)
  VALUES (_type, _message, _service, _metadata);
$$;