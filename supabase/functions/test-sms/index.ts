import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("🧪 Testing SMS functionality...");

    // Get phone number and landlord_id from request body or use defaults
    const body = await req.json().catch(() => ({}));
    const testPhone = body.phone_number || "254722241745";
    const landlordId = body.landlord_id || null;
    
    const testMessage = `🧪 Test SMS from ZIRA Property Management System

This is a test message sent at ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}.

If you received this message, the SMS system is working correctly! ✅

- ZIRA Tech Team`;

    console.log(`📱 Sending test SMS to: ${testPhone} for landlord: ${landlordId || 'admin/default'}`);

    // Send SMS using the send-sms-with-logging function
    const { data, error } = await supabase.functions.invoke('send-sms-with-logging', {
      body: {
        phone_number: testPhone,
        message: testMessage,
        message_type: 'test',
        landlord_id: landlordId
      }
    });

    if (error) {
      console.error("❌ Test SMS failed:", error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: error.message,
          test_phone: testPhone,
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Test SMS sent successfully:", data);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Test SMS sent successfully",
        test_phone: testPhone,
        response: data,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("💥 Error in test-sms:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
