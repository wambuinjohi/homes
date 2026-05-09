-- Delete the user records we just created for david.wanjau@deevabits.com
DELETE FROM public.user_roles WHERE user_id = '18c1ba95-defd-46ef-920a-600bae6443e1';
DELETE FROM public.profiles WHERE id = '18c1ba95-defd-46ef-920a-600bae6443e1';