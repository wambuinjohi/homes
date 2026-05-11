import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Check if any admin already exists
    const { data: existingAdmins, error: checkError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'Admin')
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Super admin already exists. Use create-admin-user function instead.' 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409 
        }
      );
    }

    // Parse request body
    const { email, password, firstName, lastName } = await req.json();

    console.log(`Initializing first super admin: ${email}`);

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.find(u => u.email === email);

    if (emailExists) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A user with this email address already exists.',
          duplicate: true
        }),
        { 
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Create the super admin user
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'Admin',
        email: email,
        email_verified: true
      },
      email_confirm: true
    });

    if (authCreateError) {
      console.error("Error creating user:", authCreateError);
      throw authCreateError;
    }

    console.log("Super admin created:", authData.user?.id);

    // Create user profile
    if (authData.user) {
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          phone: '',
          updated_at: new Date().toISOString()
        });

      // Assign Admin role
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'Admin',
          assigned_at: new Date().toISOString()
        });

      console.log("Super admin initialization complete");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Super admin initialized successfully",
        user: {
          id: authData.user?.id,
          email: authData.user?.email,
          role: 'Admin'
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in init-super-admin function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to initialize super admin'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
