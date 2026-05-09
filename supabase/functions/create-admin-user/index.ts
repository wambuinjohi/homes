import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    // Check if user is Admin
    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roles?.role !== 'Admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403 
        }
      );
    }

    // Parse request body
    const { email, password, firstName, lastName, role } = await req.json();

    console.log(`Admin ${user.email} creating admin user: ${email}`);

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.find(u => u.email === email);

    if (emailExists) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A user with this email address already exists. Each email can only be used once in the system.',
          duplicate: true
        }),
        { 
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Create the user with admin privileges
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        email: email,
        email_verified: true
      },
      email_confirm: true // Auto-confirm email
    });

    if (authCreateError) {
      console.error("Error creating user:", authCreateError);
      throw authCreateError;
    }

    console.log("User created successfully:", authData.user?.id);

    // Log the admin user creation activity
    if (authData.user) {
      await supabaseAdmin.rpc('log_user_activity', {
        _user_id: authData.user.id,
        _action: 'admin_user_created',
        _entity_type: 'user',
        _entity_id: authData.user.id,
        _details: JSON.stringify({
          created_by: user.id,
          created_by_email: user.email,
          email: email,
          role: role,
          auto_confirmed: true
        })
      });

      // Log security event
      await supabaseAdmin.rpc('log_security_event', {
        _event_type: 'admin_user_created',
        _details: JSON.stringify({
          target_user: authData.user.id,
          target_email: email,
          target_role: role,
          created_by: user.id
        }),
        _user_id: user.id
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        user: {
          id: authData.user?.id,
          email: authData.user?.email,
          role: role
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in create-admin-user function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});