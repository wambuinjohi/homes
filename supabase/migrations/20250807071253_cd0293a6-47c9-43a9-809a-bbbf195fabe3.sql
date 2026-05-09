-- Create missing profile for user david.wanjau@deevabits.com
INSERT INTO public.profiles (id, first_name, last_name, phone, email)
VALUES (
  '18c1ba95-defd-46ef-920a-600bae6443e1', 
  'David', 
  'Wanjau',
  NULL,
  'david.wanjau@deevabits.com'
);

-- Assign default role (Agent) to the user 
INSERT INTO public.user_roles (user_id, role)
VALUES (
  '18c1ba95-defd-46ef-920a-600bae6443e1', 
  'Agent'::public.app_role
);