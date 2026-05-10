import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_id?: string;
  related_type?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header for user authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client with user auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { 
        global: { 
          headers: { 
            authorization: authHeader 
          } 
        } 
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { user_id, title, message, type, related_id, related_type }: NotificationEmailRequest = await req.json();

    // Rate limiting check
    const now = Date.now();
    const rateLimitKey = `notification_${user.id}`;
    // Basic rate limiting: 10 notifications per minute per user
    // In production, use Redis or similar storage
    
    // Authorization check: Who can send notifications to whom?
    let authorized = false;

    // Get sender's roles
    const { data: senderRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = senderRoles?.some(r => r.role === 'Admin');
    const isLandlord = senderRoles?.some(r => r.role === 'Landlord');
    const isManager = senderRoles?.some(r => r.role === 'Manager');

    if (isAdmin) {
      // Admins can send to anyone
      authorized = true;
    } else if (user.id === user_id) {
      // Users can send to themselves
      authorized = true;
    } else if (isLandlord || isManager) {
      // Landlords/Managers can send to users associated with their properties
      const { data: managedUsers } = await supabase
        .from('tenants')
        .select(`
          user_id,
          leases!inner(
            unit_id,
            units!inner(
              property_id,
              properties!inner(owner_id, manager_id)
            )
          )
        `)
        .eq('user_id', user_id);

      authorized = managedUsers?.some(tenant => 
        tenant.leases.units.properties.owner_id === user.id ||
        tenant.leases.units.properties.manager_id === user.id
      ) || false;
    }

    if (!authorized) {
      // Log unauthorized attempt
      console.warn('Unauthorized notification attempt:', {
        sender: user.id,
        target: user_id,
        type
      });
      
      return new Response(
        JSON.stringify({ error: 'Unauthorized to send notification to this user' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize admin client only for cross-table operations after auth passes
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's notification preferences
    const { data: preferences, error: prefError } = await supabaseAdmin
      .from("notification_preferences")
      .select("email_enabled, sms_enabled")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefError && prefError.code !== 'PGRST116') {
      console.error("Error fetching preferences:", prefError);
    }

    // Get user's profile for email/phone (mask PII in logs)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, phone, first_name, last_name")
      .eq("id", user_id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    const responses = [];

    // Send email notification if enabled
    if (preferences?.email_enabled !== false && profile.email) {
      try {
        const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-notification-email', {
          body: {
            to: profile.email,
            to_name: `${profile.first_name} ${profile.last_name}`,
            subject: title,
            title,
            message,
            type,
            related_id,
            related_type
          },
          headers: {
            'x-internal-service': 'true'
          }
        });

        if (emailError) {
          console.error("Email notification error:", emailError);
        } else {
          responses.push({ channel: "email", success: true, data: emailData });
        }
      } catch (error) {
        console.error("Email notification failed:", error);
        responses.push({ channel: "email", success: false, error: error.message });
      }
    }

    // Send SMS notification if enabled
    if (preferences?.sms_enabled && profile.phone) {
      try {
        const smsMessage = `${title}: ${message}`;
        const { data: smsData, error: smsError } = await supabaseAdmin.functions.invoke('send-sms', {
          body: {
            to: profile.phone,
            message: smsMessage,
            user_id: user_id
          },
          headers: {
            'x-internal-service': 'true'
          }
        });

        if (smsError) {
          console.error("SMS notification error:", smsError);
        } else {
          responses.push({ channel: "sms", success: true, data: smsData });
        }
      } catch (error) {
        console.error("SMS notification failed:", error);
        responses.push({ channel: "sms", success: false, error: error.message });
      }
    }

    // Log the notification delivery with masked PII
    console.log('Notification sent:', {
      sender: user.id,
      recipient: user_id,
      type,
      channels: responses.length,
      success: responses.some(r => r.success)
    });

    // Log the notification delivery
    await supabaseAdmin
      .from("notification_logs")
      .insert({
        user_id,
        notification_type: type,
        message: title,
        status: responses.some(r => r.success) ? "sent" : "failed",
        sent_at: responses.some(r => r.success) ? new Date().toISOString() : null,
        error_message: responses.filter(r => !r.success).map(r => r.error).join("; ") || null
      });

    return new Response(JSON.stringify({
      success: true,
      notifications_sent: responses.length,
      responses
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
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