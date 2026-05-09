import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY FIX: Verify JWT token and authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client for authorization check
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the JWT token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the caller has Admin role using RPC function
    const { data: hasAdminRole, error: roleCheckError } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'Admin' });

    if (roleCheckError || !hasAdminRole) {
      // Log unauthorized access attempt
      await supabaseAdmin.rpc('log_security_event', {
        _event_type: 'unauthorized_access',
        _severity: 'high',
        _details: { 
          action: 'create_user_attempt', 
          user_id: user.id,
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        },
        _user_id: user.id,
        _ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
      });

      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, first_name, last_name, phone, role } = await req.json();

    // Validate required fields
    if (!email || !first_name || !last_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY FIX: Validate target role assignment permission
    const { data: canAssign, error: roleValidationError } = await supabaseAdmin
      .rpc('can_assign_role', { _assigner_id: user.id, _target_role: role });

    if (roleValidationError || !canAssign) {
      await supabaseAdmin.rpc('log_security_event', {
        _event_type: 'privilege_escalation_attempt',
        _severity: 'critical',
        _details: { 
          action: 'unauthorized_role_assignment', 
          target_role: role,
          assigner_id: user.id
        },
        _user_id: user.id,
        _ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
      });

      return new Response(
        JSON.stringify({ error: `Cannot assign ${role} role. Insufficient permissions.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user with email:', email);

    // Generate a temporary password
    const tempPassword = 'TempPass' + Math.floor(Math.random() * 10000) + '!';

    // Create the user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email for now
      user_metadata: {
        first_name,
        last_name,
        phone,
        role
      }
    });

    if (authError) {
      console.error('Auth error:', authError);

      // If the email is already registered, reject with clear error message
      if (authError.message.includes('already been registered') || 
          authError.message.includes('already exists')) {
        console.log('Email already registered. Rejecting duplicate user creation.');
        
        return new Response(
          JSON.stringify({ 
            error: 'A user with this email address already exists. Each email can only be used once in the system.',
            duplicate: true,
            email: email
          }),
          { 
            status: 409, // Conflict status code
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Handle other error cases with user-friendly messages
      let errorMessage = authError.message;
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'User creation failed - no user returned' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', authData.user.id);

    // Create profile manually since trigger may not work with admin-created users
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        first_name,
        last_name,
        email,
        phone
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail completely if profile already exists
      if (!profileError.message.includes('duplicate key')) {
        return new Response(
          JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('Profile created successfully');
    }

    // Create user role manually
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      // Don't fail completely if role already exists
      if (!roleError.message.includes('duplicate key')) {
        return new Response(
          JSON.stringify({ error: `Failed to assign user role: ${roleError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('Role assigned successfully:', role);
    }

    // Verify the role was assigned correctly
    const { data: roleCheck, error: roleCheckError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single();

    if (roleCheckError) {
      console.log('Role verification failed:', roleCheckError);
    } else {
    console.log('Role verified successfully:', roleCheck.role);
    }

    // Get communication preferences for user account creation
    let emailEnabled = true;
    let smsEnabled = false;
    
    try {
      const { data: commPref } = await supabaseAdmin
        .from('communication_preferences')
        .select('email_enabled, sms_enabled')
        .eq('setting_name', 'user_account_creation')
        .single();
      
      if (commPref) {
        emailEnabled = commPref.email_enabled;
        smsEnabled = commPref.sms_enabled;
      }
    } catch (prefError) {
      console.log("Using default communication preferences for user creation");
    }

    // Send welcome notifications based on preferences
    if (emailEnabled || smsEnabled) {
      try {
        // Send welcome email if enabled
        if (emailEnabled) {
          const { error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
            body: {
              tenant_email: email,
              tenant_name: `${first_name} ${last_name}`,
              temporary_password: tempPassword,
              user_role: role,
              property_name: "Welcome to the Platform"
            }
          });

          if (emailError) {
            console.error('Failed to send welcome email:', emailError);
          } else {
            console.log('Welcome email sent successfully');
          }
        }

        // Send welcome SMS if enabled and phone number provided
        if (smsEnabled && phone) {
          // Get active SMS provider
          const { data: providerResponse, error: providerError } = await supabaseAdmin.functions.invoke('get-sms-provider');
          
          if (!providerError && providerResponse?.provider) {
            const smsMessage = `Welcome to the platform! Your account has been created.

Role: ${role}
Email: ${email}
Temporary Password: ${tempPassword}

Please log in and change your password immediately.

- ZIRA Property Management`;

            const { error: smsError } = await supabaseAdmin.functions.invoke('send-sms-with-logging', {
              body: {
                phone_number: phone,
                message: smsMessage,
                message_type: 'credentials',
                user_id: authData.user.id,
                provider_name: providerResponse.provider.provider_name,
                provider_config: providerResponse.provider.config_data
              }
            });

            if (smsError) {
              console.error('Failed to send welcome SMS:', smsError);
            } else {
              console.log('Welcome SMS sent successfully');
            }
          } else {
            console.error('Failed to get SMS provider configuration:', providerError);
          }
        }
      } catch (notificationError) {
        console.error('Error sending welcome notifications:', notificationError);
        // Don't fail the user creation process for notification errors
      }
    }

    // Log successful user creation (audit trail)
    await supabaseAdmin.rpc('log_security_event', {
      _event_type: 'user_created',
      _severity: 'medium',
      _details: { 
        created_user_email: email,
        assigned_role: role,
        created_by: user.id
      },
      _user_id: user.id,
      _ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        email: authData.user.email,
        message: `${role} user created successfully. Login credentials sent via email.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});