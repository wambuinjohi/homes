import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  to: string;
  subject: string;
  content: string;
  template_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestData: TestEmailRequest;
    
    try {
      const requestText = await req.text();
      console.log("Request body received:", requestText);
      
      if (!requestText || requestText.trim() === '') {
        console.error("Empty request body received");
        return new Response(
          JSON.stringify({ error: "Empty request body. Please ensure the request contains valid JSON data." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      requestData = JSON.parse(requestText);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { to, subject, content, template_name } = requestData;

    if (!to || !subject || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, content" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending test email using template: ${template_name} to: ${to}`);
    console.log('Resend API Key available:', !!Deno.env.get("RESEND_API_KEY"));

    if (!Deno.env.get("RESEND_API_KEY")) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const rawFromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "support@ziratech.com";
    const rawFromName = Deno.env.get("RESEND_FROM_NAME") || "Zira Technologies";
    const fromAddress = rawFromAddress.trim().replace(/^['"]|['"]$/g, "");
    const fromName = rawFromName.trim().replace(/^['"]|['"]$/g, "");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromAddress)) {
      console.error("Invalid RESEND_FROM_ADDRESS after sanitization:", fromAddress);
      return new Response(
        JSON.stringify({
          error: "Invalid from address",
          details: "RESEND_FROM_ADDRESS must be a valid email (no quotes).",
          fromAddress,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const from = `${fromName} <${fromAddress}>`;
    console.log("Using From header:", from);
    const emailResponse = await resend.emails.send({
      from,
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Zira Homes</h1>
            <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">Test Email - ${template_name}</p>
          </div>
          <div style="padding: 30px; background: white;">
            <h2 style="color: #333; margin-top: 0;">${subject}</h2>
            <div style="white-space: pre-wrap; line-height: 1.6; color: #555;">
              ${content}
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px; margin: 0;">
              This is a test email sent from Zira Homes property management platform.
            </p>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({
          error: emailResponse.error?.message || "Failed to send test email",
          details: emailResponse.error,
          statusCode: (emailResponse.error as any)?.statusCode,
          name: (emailResponse.error as any)?.name,
          from
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-test-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send test email",
        details: error.toString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);