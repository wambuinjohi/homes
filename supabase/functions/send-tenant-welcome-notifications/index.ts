import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  tenantId: string;
  includeEmail?: boolean;
  includeSMS?: boolean;
  loginUrl?: string;
}

// Generate a random SMS-safe password (no confusing characters or symbols)
function generatePassword(length = 12): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { tenantId, includeEmail = true, includeSMS = true, loginUrl: loginUrlOverride }: NotificationRequest = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📧 Processing welcome notifications for tenant: ${tenantId}`);

    // Fetch tenant details including property and unit info
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        user_id,
        leases!leases_tenant_id_fkey!inner(
          unit_id,
          units!leases_unit_id_fkey!inner(
            unit_number,
            property_id,
            properties!units_property_id_fkey!inner(
              name
            )
          )
        )
      `)
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error("Failed to fetch tenant:", tenantError);
      return new Response(
        JSON.stringify({ success: false, error: "Tenant not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const tenantName = `${tenant.first_name} ${tenant.last_name}`;
    const propertyName = (tenant.leases?.[0]?.units?.properties as any)?.name || "Your Property";
    const unitNumber = tenant.leases?.[0]?.units?.unit_number || "N/A";

    // Generate temporary password
    const temporaryPassword = generatePassword(12);
    console.log(`🔑 Generated temporary password for ${tenant.email}`);

    // Track password update status
    let passwordUpdated = false;
    let passwordError: string | null = null;
    let authUserId: string | null = tenant.user_id ?? null;

    // Attempt to update or create auth user with temporary password
    if (authUserId) {
      // Verify the auth user still exists
      const { data: foundUser, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(authUserId);
      
      if (getUserErr || !foundUser?.user) {
        console.log(`⚠️ User ${authUserId} not found, will create new auth user`);
        authUserId = null; // Fallback to creation
      } else {
        // Ensure email matches tenant record
        if (foundUser.user.email !== tenant.email) {
          console.log(`📧 Updating email from ${foundUser.user.email} to ${tenant.email}`);
          const { error: emailUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            email: tenant.email,
            email_confirm: true,
          });
          if (emailUpdateErr) {
            console.error("⚠️ Email update failed:", emailUpdateErr);
          }
        }

        // Update password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUserId,
          { password: temporaryPassword }
        );
        
        if (!updateError) {
          passwordUpdated = true;
          console.log(`✅ Updated password for existing user ${authUserId}`);
        } else {
          console.error("❌ Password update failed, will try create:", updateError);
          passwordError = updateError.message;
          authUserId = null; // Fallback to create
        }
      }
    }

    // Create new auth user if update failed or no user_id exists
    if (!authUserId) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: tenant.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          first_name: tenant.first_name,
          last_name: tenant.last_name,
          role: 'Tenant',  // Solution 1: Explicitly set Tenant role
        },
      });

      if (createError) {
        console.error("❌ Failed to create auth user:", createError);
        passwordError = createError.message || "Failed to create auth user";
        
        if (createError.message?.includes("already registered")) {
          passwordError = "Email already registered. Please use 'Forgot Password' instead.";
        }
      } else if (newUser.user) {
        passwordUpdated = true;
        console.log(`✅ Created new auth user ${newUser.user.id}`);
        
        // Link tenant to auth user
        await supabaseAdmin
          .from("tenants")
          .update({ user_id: newUser.user.id })
          .eq("id", tenantId);

        // Assign Tenant role
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role: "Tenant" });
      }
    }

    const loginUrl = loginUrlOverride || `${supabaseUrl.replace('.supabase.co', '')}/auth`;
    console.log(`🔑 passwordUpdated=${passwordUpdated}, loginUrl=${loginUrl}`);
    const results: any = { tenantId, email: null, sms: null };

    // Only send notifications if password was successfully updated
    if (!passwordUpdated) {
      console.error("❌ Password not updated, skipping notifications");
      results.email = includeEmail ? { success: false, error: "Password not updated" } : null;
      results.sms = includeSMS ? { success: false, error: "Password not updated" } : null;
      
      return new Response(
        JSON.stringify({
          success: false,
          passwordUpdated: false,
          passwordError,
          results,
          tenant: {
            id: tenant.id,
            email: tenant.email,
            name: tenantName,
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send Email
    if (includeEmail) {
      try {
        const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke(
          "send-welcome-email",
          {
            body: {
              tenantEmail: tenant.email,
              tenantName,
              propertyName,
              unitNumber,
              temporaryPassword,
              loginUrl,
            },
          }
        );

        if (emailError) {
          console.error("❌ Email sending failed:", emailError);
          results.email = { success: false, error: emailError.message };
        } else {
          console.log("✅ Welcome email sent successfully");
          results.email = { success: true, data: emailData };
        }
      } catch (error: any) {
        console.error("❌ Email exception:", error);
        results.email = { success: false, error: error.message };
      }
    }

    // Send SMS
    if (includeSMS && tenant.phone) {
      try {
        // Get landlord ID from property ownership
        const propertyId = tenant.leases?.[0]?.units?.property_id;
        let landlordId: string | null = null;
        
        if (propertyId) {
          const { data: property } = await supabaseAdmin
            .from("properties")
            .select("owner_id")
            .eq("id", propertyId)
            .single();
          landlordId = property?.owner_id || null;
        }

        const smsMessage = `Welcome to Zira Homes! Your login:\nEmail: ${tenant.email}\nPassword: ${temporaryPassword}\nLogin: ${loginUrl}`;
        
        const { data: smsData, error: smsError } = await supabaseAdmin.functions.invoke(
          "send-sms-with-logging",
          {
            body: {
              phone_number: tenant.phone,
              message: smsMessage,
              message_type: "tenant_welcome",
              landlord_id: landlordId,
              user_id: tenant.user_id,
            },
          }
        );

        if (smsError) {
          console.error("❌ SMS sending failed:", smsError);
          results.sms = { success: false, error: smsError.message };
        } else {
          console.log("✅ Welcome SMS sent successfully");
          results.sms = { success: true, data: smsData };
        }
      } catch (error: any) {
        console.error("❌ SMS exception:", error);
        results.sms = { success: false, error: error.message };
      }
    } else if (includeSMS && !tenant.phone) {
      results.sms = { success: false, error: "No phone number provided" };
    }

    // Overall success if at least one notification succeeded
    const overallSuccess = results.email?.success || results.sms?.success;

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        passwordUpdated: true,
        passwordError: null,
        results,
        tenant: {
          id: tenant.id,
          email: tenant.email,
          name: tenantName,
        },
      }),
      {
        status: overallSuccess ? 200 : 207, // 207 = Multi-Status
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-tenant-welcome-notifications:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
