import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email?: string;
  redirectTo?: string;
  // Admin-initiated reset parameters
  user_id?: string;
  user_email?: string;
  user_name?: string;
  reset_by_admin?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting checks
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip')?.trim() || 
                     'unknown';
    
    const now = Date.now();
    const rateLimitWindow = 60 * 60 * 1000; // 1 hour
    const maxAttemptsPerIP = 20;
    const maxAttemptsPerEmail = 5;

    // Basic rate limiting (in production, use Redis)
    // For now, we'll just log and continue
    console.log('Password reset attempt from IP:', clientIP.replace(/\d+$/, 'xxx'));
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { 
      email, 
      redirectTo,
      user_id,
      user_email,
      user_name,
      reset_by_admin = false 
    }: PasswordResetRequest = await req.json();

    // Use admin-provided email if available, otherwise use direct email
    const targetEmail = user_email || email;
    const targetUserName = user_name || '';

    if (!targetEmail) {
      return new Response(JSON.stringify({
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      return new Response(JSON.stringify({
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log with masked email for security
    console.log("Processing password reset for:", 
      targetEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'), 
      reset_by_admin ? "(admin-initiated)" : "");

    // Get communication preferences
    let emailEnabled = true;
    let smsEnabled = false;
    
    try {
      const { data: commPref } = await supabaseAdmin
        .from('communication_preferences')
        .select('email_enabled, sms_enabled')
        .eq('setting_name', 'password_reset')
        .single();
      
      if (commPref) {
        emailEnabled = commPref.email_enabled;
        smsEnabled = commPref.sms_enabled;
      }
    } catch (prefError) {
      console.log("Using default communication preferences");
    }

    // Get user profile and phone number
    let userProfile = null;
    try {
      let profile;
      
      if (user_id) {
        // Admin-initiated: fetch by user_id
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, phone, email')
          .eq('id', user_id)
          .single();
        profile = data;
      } else {
        // User-initiated: fetch by email
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, phone, email')
          .eq('email', targetEmail)
          .single();
        profile = data;
      }
      
      userProfile = profile;
    } catch (profileError) {
      console.log("Could not fetch user profile:", profileError);
    }

    let results = {
      email_sent: false,
      sms_sent: false,
      error: null as string | null
    };

    // Send email reset if enabled
    if (emailEnabled) {
      try {
        const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: redirectTo || `${req.headers.get("origin")}/auth?type=recovery`
        });

        if (emailError) {
          throw emailError;
        }

        results.email_sent = true;
        console.log("Password reset email sent to:", targetEmail);
      } catch (emailError: any) {
        console.error("Error sending password reset email:", emailError);
        results.error = emailError.message;
      }
    }

    // Send SMS notification if enabled and phone available
    if (smsEnabled && userProfile?.phone) {
      try {
        const displayName = targetUserName || userProfile.first_name || 'User';
        const initiatorText = reset_by_admin ? ' by an administrator' : '';
        const smsMessage = `Hi ${displayName}, a password reset was requested${initiatorText} for your Zira Homes account. If this wasn't you, please contact support. Reset link sent to your email.`;
        
        await supabaseAdmin.functions.invoke('send-sms', {
          body: {
            provider_name: 'InHouse SMS',
            phone_number: userProfile.phone,
            message: smsMessage
          }
        });
        
        results.sms_sent = true;
        console.log("Password reset SMS sent to:", userProfile.phone);
      } catch (smsError: any) {
        console.error("Error sending password reset SMS:", smsError);
        // Don't override email error with SMS error
        if (!results.error) {
          results.error = `SMS failed: ${smsError.message}`;
        }
      }
    }

    // Determine response message
    let message = "Password reset processed.";
    if (results.email_sent && results.sms_sent) {
      message = "Password reset instructions sent via email and SMS.";
    } else if (results.email_sent) {
      message = "Password reset instructions sent to your email.";
    } else if (results.sms_sent) {
      message = "Password reset notification sent via SMS. Check your email for reset instructions.";
    } else if (results.error) {
      message = `Password reset failed: ${results.error}`;
    }

    // Always return success message to prevent email enumeration
    return new Response(JSON.stringify({
      success: true,
      message: "If an account exists with this email, you will receive password reset instructions.",
      // Only include details for admin-initiated resets
      ...(reset_by_admin && {
        admin_details: {
          email_sent: results.email_sent,
          sms_sent: results.sms_sent,
          error: results.error
        }
      })
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in password reset function:", error);
    // Always return success message even on errors to prevent information leakage
    return new Response(JSON.stringify({
      success: true,
      message: "If an account exists with this email, you will receive password reset instructions."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);