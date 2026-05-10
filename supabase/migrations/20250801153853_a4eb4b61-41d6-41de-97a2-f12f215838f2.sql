-- First, let's check if there are any profiles at all
DO $$
DECLARE
    user_exists BOOLEAN;
BEGIN
    -- Check if the user exists in auth.users but not in profiles
    SELECT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d'
        AND id NOT IN (SELECT id FROM public.profiles)
    ) INTO user_exists;
    
    -- If user exists but has no profile, create one
    IF user_exists THEN
        INSERT INTO public.profiles (id, first_name, last_name, phone, email)
        SELECT 
            u.id,
            u.raw_user_meta_data ->> 'first_name' as first_name,
            u.raw_user_meta_data ->> 'last_name' as last_name,
            u.raw_user_meta_data ->> 'phone' as phone,
            u.email
        FROM auth.users u
        WHERE u.id = 'a53f69a5-104e-489b-9b0a-48a56d6b011d';
        
        RAISE NOTICE 'Created profile for existing user';
    END IF;
END $$;