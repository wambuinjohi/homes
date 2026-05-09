import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('SUPABASE_ACCESS_TOKEN');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const projectRef = 'kdpqimetajnhcqseajok';

    if (!accessToken) {
      throw new Error('SUPABASE_ACCESS_TOKEN is not configured');
    }

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    console.log('Configuring SMTP settings via Supabase Management API...');

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          smtp_host: 'smtp.resend.com',
          smtp_port: '465',
          smtp_user: 'resend',
          smtp_pass: resendApiKey,
          smtp_admin_email: 'support@ziratech.com',
          smtp_sender_name: 'Zira Technologies'
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase API error:', errorText);
      throw new Error(`Failed to configure SMTP: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('SMTP configured successfully:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMTP configured successfully. Auth emails will now be sent from support@ziratech.com' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error configuring SMTP:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
