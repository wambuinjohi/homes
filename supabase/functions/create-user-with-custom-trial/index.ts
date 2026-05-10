import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: 'Landlord' | 'Manager' | 'Agent';
  custom_trial_config?: {
    trial_days: number;
    grace_days: number;
  };
}

Deno.serve(async (req) => {
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the JWT token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the caller has Admin role using RPC function
    const { data: hasAdminRole, error: roleCheckError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'Admin' });

    if (roleCheckError || !hasAdminRole) {
      // Log unauthorized access attempt
      await supabase.rpc('log_security_event', {
        _event_type: 'unauthorized_access',
        _severity: 'high',
        _details: { 
          action: 'create_custom_trial_attempt', 
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

    const requestData: CreateUserRequest = await req.json();
    
    console.log('📝 Creating user with custom trial:', {
      email: requestData.email,
      role: requestData.role,
      trial_config: requestData.custom_trial_config
    });

    // Check if email already exists before creating
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.find(u => u.email === requestData.email);

    if (emailExists) {
      return new Response(
        JSON.stringify({ 
          error: 'A user with this email address already exists. Each email can only be used once in the system.',
          duplicate: true
        }),
        { 
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate a temporary password
    const tempPassword = 'Welcome' + Math.floor(Math.random() * 10000) + '!';
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: requestData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: requestData.first_name,
        last_name: requestData.last_name,
        phone: requestData.phone,
        role: requestData.role,
        custom_trial_config: requestData.custom_trial_config
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    console.log('✅ User created in auth:', authData.user.id);

    // Create profile entry
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        first_name: requestData.first_name,
        last_name: requestData.last_name,
        email: requestData.email,
        phone: requestData.phone
      });

    if (profileError) {
      console.error('❌ Profile error:', profileError);
      throw profileError;
    }

    console.log('✅ Profile created');

    // Create user role entry with custom trial metadata
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: requestData.role,
        metadata: requestData.custom_trial_config ? {
          trial_days: requestData.custom_trial_config.trial_days,
          grace_days: requestData.custom_trial_config.grace_days
        } : null
      });

    if (roleError) {
      console.error('❌ Role error:', roleError);
      throw roleError;
    }

    console.log('✅ User role created with custom trial config');

    // The trigger will automatically create the subscription with custom trial period
    // Let's wait a moment and verify it was created
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: subscription, error: subError } = await supabase
      .from('landlord_subscriptions')
      .select('*')
      .eq('landlord_id', authData.user.id)
      .single();

    if (subError) {
      console.warn('⚠️ Subscription check error (might be created later):', subError);
    } else {
      console.log('✅ Subscription created:', subscription);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        email: requestData.email,
        temporary_password: tempPassword,
        trial_config: requestData.custom_trial_config,
        message: `User created successfully with ${requestData.custom_trial_config?.trial_days || 30}-day trial period. They can sign in with the temporary password.`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});