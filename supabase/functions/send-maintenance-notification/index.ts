import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  maintenance_request_id: string;
  notification_type: "status_change" | "assignment" | "resolution";
  tenant_id: string;
  old_status?: string;
  new_status?: string;
  service_provider_name?: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Notification service called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user from JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has appropriate role (Admin, Landlord, Manager, or Agent)
    const { data: hasValidRole, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'Admin'
    });

    const { data: hasLandlordRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'Landlord'
    });

    const { data: hasManagerRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'Manager'
    });

    if (roleError || (!hasValidRole && !hasLandlordRole && !hasManagerRole)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      maintenance_request_id, 
      notification_type, 
      tenant_id, 
      old_status, 
      new_status, 
      service_provider_name,
      message 
    }: NotificationRequest = await req.json();

    console.log("Processing notification:", {
      maintenance_request_id,
      notification_type,
      tenant_id
    });

    // Get tenant information
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("first_name, last_name, email, phone")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    // Get maintenance request details
    const { data: request, error: requestError } = await supabase
      .from("maintenance_requests")
      .select(`
        title, 
        description,
        properties (name),
        units (unit_number)
      `)
      .eq("id", maintenance_request_id)
      .single();

    if (requestError || !request) {
      throw new Error("Maintenance request not found");
    }

    // Check if user has notification preferences
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("email_enabled, sms_enabled")
      .eq("user_id", tenant_id)
      .single();

    const emailEnabled = preferences?.email_enabled ?? true;
    const smsEnabled = preferences?.sms_enabled ?? false;

    // Prepare notification content based on type
    let subject = "";
    let emailContent = "";
    let smsContent = "";

    switch (notification_type) {
      case "status_change":
        subject = `Maintenance Request Status Update - ${request.title}`;
        emailContent = `
          <h2>Maintenance Request Status Update</h2>
          <p>Hello ${tenant.first_name},</p>
          <p>Your maintenance request has been updated:</p>
          <ul>
            <li><strong>Request:</strong> ${request.title}</li>
            <li><strong>Property:</strong> ${request.properties?.name}</li>
            ${request.units ? `<li><strong>Unit:</strong> ${request.units.unit_number}</li>` : ""}
            <li><strong>Status:</strong> ${new_status?.replace('_', ' ').toUpperCase()}</li>
          </ul>
          ${message ? `<p><strong>Additional Notes:</strong> ${message}</p>` : ""}
          <p>Thank you for your patience.</p>
        `;
        smsContent = `Maintenance Update: ${request.title} status changed to ${new_status?.replace('_', ' ')}. Property: ${request.properties?.name}${message ? `. Note: ${message}` : ""}`;
        break;

      case "assignment":
        subject = `Service Provider Assigned - ${request.title}`;
        emailContent = `
          <h2>Service Provider Assigned</h2>
          <p>Hello ${tenant.first_name},</p>
          <p>A service provider has been assigned to your maintenance request:</p>
          <ul>
            <li><strong>Request:</strong> ${request.title}</li>
            <li><strong>Property:</strong> ${request.properties?.name}</li>
            ${request.units ? `<li><strong>Unit:</strong> ${request.units.unit_number}</li>` : ""}
            <li><strong>Assigned To:</strong> ${service_provider_name}</li>
          </ul>
          <p>They will contact you soon to schedule the work.</p>
        `;
        smsContent = `Service provider ${service_provider_name} assigned to your maintenance request: ${request.title}. They will contact you soon.`;
        break;

      case "resolution":
        subject = `Maintenance Request Completed - ${request.title}`;
        emailContent = `
          <h2>Maintenance Request Completed</h2>
          <p>Hello ${tenant.first_name},</p>
          <p>Your maintenance request has been completed:</p>
          <ul>
            <li><strong>Request:</strong> ${request.title}</li>
            <li><strong>Property:</strong> ${request.properties?.name}</li>
            ${request.units ? `<li><strong>Unit:</strong> ${request.units.unit_number}</li>` : ""}
          </ul>
          ${message ? `<p><strong>Resolution Notes:</strong> ${message}</p>` : ""}
          <p>If you have any concerns, please contact us.</p>
        `;
        smsContent = `Maintenance request completed: ${request.title} at ${request.properties?.name}${message ? `. Notes: ${message}` : ""}`;
        break;
    }

    const notifications = [];

    // Send Email Notification
    if (emailEnabled && tenant.email) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      if (resendApiKey) {
        try {
          console.log("Sending email notification");
          
          const rawFromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "support@ziratech.com";
          const rawFromName = Deno.env.get("RESEND_FROM_NAME") || "Zira Technologies";
          const from = `${rawFromName.trim().replace(/^['\"]|['\"]$/g, "")} <${rawFromAddress.trim().replace(/^['\"]|['\"]$/g, "")}>`;
          
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: [tenant.email],
              subject: subject,
              html: emailContent,
            }),
          });

          const emailResult = await emailResponse.json();
          
          if (emailResponse.ok) {
            console.log("Email sent successfully:", emailResult.id);
            notifications.push({
              user_id: tenant_id,
              maintenance_request_id,
              notification_type: "email",
              status: "sent",
              subject: subject,
              message: emailContent,
              sent_at: new Date().toISOString()
            });
          } else {
            console.error("Email sending failed:", emailResult);
            notifications.push({
              user_id: tenant_id,
              maintenance_request_id,
              notification_type: "email",
              status: "failed",
              subject: subject,
              message: emailContent,
              error_message: emailResult.message || "Email sending failed"
            });
          }
        } catch (emailError) {
          console.error("Email error:", emailError);
          notifications.push({
            user_id: tenant_id,
            maintenance_request_id,
            notification_type: "email",
            status: "failed",
            subject: subject,
            message: emailContent,
            error_message: emailError.message
          });
        }
      } else {
        console.log("Resend API key not configured - skipping email");
        notifications.push({
          user_id: tenant_id,
          maintenance_request_id,
          notification_type: "email",
          status: "failed",
          subject: subject,
          message: emailContent,
          error_message: "Resend API key not configured"
        });
      }
    }

    // Send SMS Notification using unified SMS system
    if (smsEnabled && tenant.phone) {
      try {
        console.log("Sending SMS notification via unified SMS system");
        
        // Use send-sms-with-logging edge function
        const { data: smsResult, error: smsError } = await supabase.functions.invoke(
          'send-sms-with-logging',
          {
            body: {
              phone_number: tenant.phone,
              message: smsContent,
              user_id: tenant_id,
            }
          }
        );

        if (smsError) {
          console.error("SMS sending failed:", smsError);
          notifications.push({
            user_id: tenant_id,
            maintenance_request_id,
            notification_type: "sms",
            status: "failed",
            subject: subject,
            message: smsContent,
            error_message: smsError.message || "SMS sending failed"
          });
        } else if (smsResult?.success) {
          console.log("SMS sent successfully:", smsResult.log_id);
          notifications.push({
            user_id: tenant_id,
            maintenance_request_id,
            notification_type: "sms",
            status: "sent",
            subject: subject,
            message: smsContent,
            sent_at: new Date().toISOString()
          });
        } else {
          console.error("SMS sending failed:", smsResult);
          notifications.push({
            user_id: tenant_id,
            maintenance_request_id,
            notification_type: "sms",
            status: "failed",
            subject: subject,
            message: smsContent,
            error_message: smsResult?.error || "SMS sending failed"
          });
        }
      } catch (smsError: any) {
        console.error("SMS error:", smsError);
        notifications.push({
          user_id: tenant_id,
          maintenance_request_id,
          notification_type: "sms",
          status: "failed",
          subject: subject,
          message: smsContent,
          error_message: smsError.message
        });
      }
    }

    // Log all notifications to database
    if (notifications.length > 0) {
      const { error: logError } = await supabase
        .from("notification_logs")
        .insert(notifications);

      if (logError) {
        console.error("Error logging notifications:", logError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      notifications_sent: notifications.length,
      details: notifications
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in notification service:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);