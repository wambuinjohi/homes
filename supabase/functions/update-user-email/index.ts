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
    // Initialize Supabase client for authentication check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Authenticate user from JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has Admin role
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'Admin'
    });

    if (roleError || !hasAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, new_email } = await req.json();

    // Validate required fields
    if (!user_id || !new_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id and new_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the service role key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Updating user email for user ID:', user_id, 'to:', new_email);

    // Update the user's email in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { email: new_email }
    );

    if (authError) {
      console.error('Auth email update error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to update email in auth: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth email updated successfully');

    // Don't send automatic password reset email since it auto-logs users in
    // Instead, return a message telling admin to provide the direct reset link
    console.log('Email updated successfully');
    console.log('Admin should provide this password reset link to user:', 'https://3774a0bb-6806-44c5-9bd5-60f4b2d265f5.lovableproject.com/auth?type=recovery');
    
    // Optionally still send the email but user should use the direct link
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(new_email, {
      redirectTo: 'https://3774a0bb-6806-44c5-9bd5-60f4b2d265f5.lovableproject.com/auth?type=recovery'
    });
    
    if (resetError) {
      console.error('Password reset email error:', resetError);
    } else {
      console.log('Password reset email sent, but user should use direct link for better experience');
    }

    // Update the email in the profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email: new_email })
      .eq('id', user_id);

    if (profileError) {
      console.error('Profile email update error:', profileError);
      return new Response(
        JSON.stringify({ error: `Failed to update email in profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile email updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user_id: user_id,
        new_email: new_email,
        message: 'User email updated successfully. A password reset email has been sent to the new email address.',
        password_reset_sent: true
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