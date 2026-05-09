-- Add missing INSERT policy for notifications table
CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Add policy for users to insert their own notifications
CREATE POLICY "Users can create their own notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add policy for support message authors to insert notifications  
CREATE POLICY "Support messages can create notifications"
ON public.notifications 
FOR INSERT 
WITH CHECK (
  type = 'support' AND 
  (related_type = 'support_ticket' OR related_type IS NULL)
);