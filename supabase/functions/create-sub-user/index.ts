import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSubUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  title?: string;
  password?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    view_reports: boolean;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Caller authentication (landlord)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    const landlord = userData?.user || null;

    if (authError || !landlord) {
      console.error('Auth getUser failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message || null, success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify landlord role using user_roles table to avoid RPC dependency
    const { data: roleRow, error: roleErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', landlord.id)
      .eq('role', 'Landlord')
      .limit(1)
      .maybeSingle();

    if (roleErr || !roleRow) {
      console.error('Role verification failed or user is not a landlord:', roleErr);
      return new Response(
        JSON.stringify({ error: 'Only landlords can create sub-users', details: roleErr?.message || null, success: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: CreateSubUserRequest = await req.json();
    const { email, first_name, last_name, phone, title, password, permissions } = requestData;

    if (!email || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: 'email, first_name and last_name are required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate custom password if provided
    if (password && password.trim().length > 0 && password.trim().length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating sub-user:', { email, first_name, last_name, landlord_id: landlord.id, custom_password: !!password });

    // Find existing user via profiles table by unique email
    const { data: existingProfile, error: profileLookupErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (profileLookupErr) {
      console.warn('Profile lookup error (continuing):', profileLookupErr);
    }

    let userId: string;
    let isNewUser = false;
    let isPasswordReset = false;
    let isCustomPassword = false;
    // Use custom password if provided, otherwise generate one
    const tempPassword = password && password.trim().length > 0 
      ? password.trim() 
      : `SubUser${Math.floor(Math.random() * 100000)}!${Date.now().toString(36).slice(-4)}`;
    
    if (password && password.trim().length > 0) {
      isCustomPassword = true;
      console.log('Using custom password provided by landlord');
    }

    if (existingProfile?.id) {
      userId = existingProfile.id;

      // Prevent duplicate active sub-user link
      const { data: existingSubUser, error: existingSubUserErr } = await supabase
        .from('sub_users')
        .select('id, status')
        .eq('landlord_id', landlord.id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (!existingSubUserErr && existingSubUser) {
        return new Response(
          JSON.stringify({ 
            error: 'A user with this email address already exists. Each email can only be used once in the system.',
            duplicate: true,
            email: email,
            success: false 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset password for existing user to allow landlord to share new credentials
      console.log('Resetting password for existing user:', userId);
      const { error: passwordResetError } = await supabase.auth.admin.updateUserById(userId, {
        password: tempPassword,
        user_metadata: {
          ...existingProfile,
          first_name: first_name || existingProfile.first_name,
          last_name: last_name || existingProfile.last_name,
          phone: phone || existingProfile.phone,
          role: 'SubUser',
        }
      });

      if (passwordResetError) {
        console.error('Error resetting password for existing user:', passwordResetError);
        return new Response(
          JSON.stringify({ error: `Failed to reset password: ${passwordResetError.message}`, success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      isPasswordReset = true;

      // Update profile fields if provided
      const shouldUpdate = Boolean(first_name || last_name || phone);
      if (shouldUpdate) {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            first_name: first_name || existingProfile.first_name || null,
            last_name: last_name || existingProfile.last_name || null,
            phone: phone === '' ? null : (phone || existingProfile.phone || null),
          })
          .eq('id', userId);
        if (profileUpdateError) {
          console.warn('Profile update failed (non-critical):', profileUpdateError);
        }
      }
    } else {
      // Create new auth user via Admin API with generated password
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
          phone,
          created_by: landlord.id,
          role: 'SubUser',
        },
      });

      if (createUserError || !newUser?.user) {
        console.error('Error creating auth user:', createUserError);
        return new Response(
          JSON.stringify({ error: `Failed to create user account: ${createUserError?.message || 'unknown error'}`, success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      isNewUser = true;

      // Check if profile already exists (auth trigger may have created it)
      const { data: existingProfileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      // Create profile record only if it doesn't exist
      if (!existingProfileCheck) {
        console.log('Creating profile for new user:', userId);
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: userId, first_name, last_name, email, phone: phone || null });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          await supabase.auth.admin.deleteUser(userId);
          return new Response(
            JSON.stringify({ error: `Failed to create user profile: ${profileError.message}`, success: false }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log('Profile already exists for user:', userId);
      }
    }

    // Insert sub_users record
    const { error: subUserError } = await supabase
      .from('sub_users')
      .insert({
        landlord_id: landlord.id,
        user_id: userId,
        title: title || null,
        permissions,
        status: 'active',
      });

    if (subUserError) {
      console.error('Error creating sub-user:', subUserError);
      if (isNewUser) {
        await supabase.auth.admin.deleteUser(userId);
        await supabase.from('profiles').delete().eq('id', userId);
      }
      return new Response(
        JSON.stringify({ error: `Failed to create sub-user record: ${subUserError.message}`, success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign SubUser role in user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'SubUser'
      }, {
        onConflict: 'user_id,role'
      });

    if (roleError) {
      console.warn('Failed to assign SubUser role (non-critical):', roleError);
    } else {
      console.log('SubUser role assigned successfully to user:', userId);
    }

    const responseMessage = isNewUser
      ? 'Sub-user created successfully with new account'
      : isPasswordReset 
        ? 'Sub-user linked successfully - password has been reset'
        : 'Sub-user created successfully with existing account';

    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage,
        user_id: userId,
        temporary_password: isCustomPassword ? undefined : tempPassword,
        password_reset: isPasswordReset,
        is_new_user: isNewUser,
        is_custom_password: isCustomPassword,
        email: email,
        instructions: isCustomPassword 
          ? 'Sub-user created with your custom password.' 
          : 'Share these credentials securely with the sub-user. They should change their password on first login.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-sub-user function:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as any)?.status || 500;
    return new Response(
      JSON.stringify({ error: message, success: false, details: (error as any)?.details || null }),
      { status: typeof status === 'number' ? status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
