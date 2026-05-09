import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  phone_number: string;
  message: string;
  provider_name?: string;
  provider_config?: any;
  landlord_id?: string;
  user_id?: string;
  message_type?: string;
}

/**
 * Format phone number to E.164 format (254...)
 */
function formatPhoneNumber(phone: string): { formatted: string; isValid: boolean; error?: string } {
  if (!phone) {
    return { formatted: '', isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');

  // Handle different input formats
  if (cleaned.startsWith('254')) {
    // Already has country code
    cleaned = cleaned;
  } else if (cleaned.startsWith('0')) {
    // Remove leading 0 and add 254
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    // Missing leading 0 and country code
    cleaned = '254' + cleaned;
  }

  // Validate length (should be 12 digits: 254 + 9 digits)
  if (cleaned.length !== 12) {
    return {
      formatted: cleaned,
      isValid: false,
      error: `Invalid phone number length. Expected 12 digits, got ${cleaned.length}`
    };
  }

  // Validate Kenyan mobile format (254 followed by 7/1/0)
  const kenyanPattern = /^254[710]\d{8}$/;
  if (!kenyanPattern.test(cleaned)) {
    return {
      formatted: cleaned,
      isValid: false,
      error: 'Invalid Kenyan mobile number format'
    };
  }

  return { formatted: cleaned, isValid: true };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Authenticate user
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    let isAdmin = false;
    let effectiveLandlordId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: hasRole } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'Admin'
        });
        isAdmin = hasRole || false;
      }
    }

    const body: SMSRequest = await req.json();
    const { phone_number, message, provider_name, provider_config, landlord_id, user_id, message_type } = body;

    // Determine effective landlord ID (use provided or current user)
    effectiveLandlordId = landlord_id || userId;

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone_number, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number
    const phoneResult = formatPhoneNumber(phone_number);
    if (!phoneResult.isValid) {
      // Log failed attempt
      await supabase.from('sms_logs').insert({
        phone_number: phone_number,
        phone_number_formatted: phoneResult.formatted,
        message_content: message,
        status: 'failed',
        failed_at: new Date().toISOString(),
        error_message: phoneResult.error || 'Invalid phone number format',
        provider_name: provider_name || 'Unknown',
        landlord_id: landlord_id || userId,
        user_id: user_id,
        message_type: message_type || 'general',
        created_by: userId
      });

      return new Response(
        JSON.stringify({ 
          error: phoneResult.error || 'Invalid phone number format',
          phone_number: phone_number,
          formatted: phoneResult.formatted
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 Sending SMS to formatted number: ${phoneResult.formatted}`);

    // Replace {landlord_name} variable if present in message
    let processedMessage = message;
    if (message.includes('{landlord_name}') && effectiveLandlordId) {
      const { data: landlordProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', effectiveLandlordId)
        .single();
      
      if (landlordProfile) {
        const landlordName = `${landlordProfile.first_name || ''} ${landlordProfile.last_name || ''}`.trim() || 'Management';
        processedMessage = processedMessage.replace(/{landlord_name}/g, landlordName);
        console.log(`✅ Replaced {landlord_name} with: ${landlordName}`);
      }
    }

    // Check SMS credits for non-admin users
    if (!isAdmin && effectiveLandlordId) {
      const { data: subscription, error: subError } = await supabase
        .from('landlord_subscriptions')
        .select('sms_credits_balance')
        .eq('landlord_id', effectiveLandlordId)
        .single();

      if (subError) {
        console.error('Error checking SMS credits:', subError);
        return new Response(
          JSON.stringify({ error: 'Failed to check SMS credits' }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const creditsBalance = subscription?.sms_credits_balance || 0;
      
      if (creditsBalance < 1) {
        console.warn(`❌ Insufficient SMS credits for landlord ${effectiveLandlordId}. Balance: ${creditsBalance}`);
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient SMS credits',
            credits_balance: creditsBalance,
            message: 'Please purchase SMS credits to continue sending messages'
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ SMS credits available: ${creditsBalance}`);
    }

    // Create initial log entry (use processed message with variables replaced)
    const { data: smsLog, error: logError } = await supabase
      .from('sms_logs')
      .insert({
        phone_number: phone_number,
        phone_number_formatted: phoneResult.formatted,
        message_content: processedMessage,
        status: 'pending',
        provider_name: provider_name || 'InHouse SMS',
        landlord_id: effectiveLandlordId,
        user_id: user_id,
        message_type: message_type || 'general',
        created_by: userId
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating SMS log:", logError);
    }

    // Send SMS via the send-sms function with internal/system headers
    try {
      const { data: smsResponse, error: smsError } = await supabase.functions.invoke('send-sms', {
        body: {
          phone_number: phoneResult.formatted,
          message: processedMessage, // Use processed message with variables replaced
          provider_name: provider_name,
          provider_config: provider_config,
          landlord_id: landlord_id || userId
        },
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'x-internal-call': 'true'
        }
      });

      if (smsError || !smsResponse?.success) {
        // Update log with failure
        if (smsLog) {
          await supabase
            .from('sms_logs')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              error_message: smsError?.message || smsResponse?.error || 'SMS sending failed',
              provider_response: smsResponse
            })
            .eq('id', smsLog.id);
        }

        return new Response(
          JSON.stringify({ 
            success: false,
            error: smsError?.message || smsResponse?.error || 'SMS sending failed',
            log_id: smsLog?.id
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update log with success
      if (smsLog) {
        await supabase
          .from('sms_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_response: smsResponse
          })
          .eq('id', smsLog.id);
      }

      // Deduct SMS credit for non-admin users
      if (!isAdmin && effectiveLandlordId) {
        // Get current balance before deduction
        const { data: subscription } = await supabase
          .from('landlord_subscriptions')
          .select('sms_credits_balance')
          .eq('landlord_id', effectiveLandlordId)
          .single();

        const currentBalance = subscription?.sms_credits_balance || 0;
        const newBalance = currentBalance - 1;

        const { error: deductError } = await supabase
          .from('landlord_subscriptions')
          .update({ 
            sms_credits_balance: newBalance
          })
          .eq('landlord_id', effectiveLandlordId)
          .gt('sms_credits_balance', 0);

        if (deductError) {
          console.error('Error deducting SMS credit:', deductError);
          // Don't fail the request, just log the error
        } else {
          console.log(`💳 Deducted 1 SMS credit from landlord ${effectiveLandlordId}`);
          
          // Log credit usage transaction
          const { error: txError } = await supabase
            .from('sms_credit_transactions')
            .insert({
              landlord_id: effectiveLandlordId,
              transaction_type: 'usage',
              credits_change: -1,
              balance_after: newBalance,
              description: `SMS sent to ${phoneResult.formatted}`,
              reference_id: smsLog?.id,
              reference_type: 'sms_log',
              created_by: userId,
              metadata: {
                phone_number: phoneResult.formatted,
                message_length: message.length,
                message_type: message_type || 'general',
                provider: provider_name || 'InHouse SMS'
              }
            });

          if (txError) {
            console.error('Error logging SMS credit transaction:', txError);
          } else {
            console.log(`📝 Logged SMS credit usage transaction. New balance: ${newBalance}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "SMS sent successfully",
          phone_number_formatted: phoneResult.formatted,
          log_id: smsLog?.id
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (smsErr: any) {
      // Update log with error
      if (smsLog) {
        await supabase
          .from('sms_logs')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: smsErr.message || 'SMS sending exception'
          })
          .eq('id', smsLog.id);
      }

      throw smsErr;
    }

  } catch (error: any) {
    console.error("Error in send-sms-with-logging:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
