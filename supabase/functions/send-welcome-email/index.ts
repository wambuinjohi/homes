import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  tenantEmail: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  temporaryPassword: string;
  loginUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const resend = new Resend(apiKey);
    const { 
      tenantEmail, 
      tenantName, 
      propertyName, 
      unitNumber, 
      temporaryPassword, 
      loginUrl 
    }: WelcomeEmailRequest = await req.json();

    console.log(`Sending welcome email to ${tenantEmail}`);

    const rawFromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "support@ziratech.com";
    const rawFromName = Deno.env.get("RESEND_FROM_NAME") || "Zira Technologies";
    const fromAddress = rawFromAddress.trim().replace(/^['"]|['"]$/g, "");
    const fromName = rawFromName.trim().replace(/^['"]|['"]$/g, "");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromAddress)) {
      console.error("Invalid RESEND_FROM_ADDRESS after sanitization:", fromAddress);
      return new Response(
        JSON.stringify({
          success: false,
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
      to: [tenantEmail],
      subject: "Welcome to Zira Homes - Your Tenant Portal Access",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Zira Homes</title>
            <style>
              body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: white; }
              .header { background: linear-gradient(135deg, #1A73E8 0%, #1557B0 100%); padding: 40px 20px; text-align: center; }
              .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
              .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px; }
              .content { padding: 40px 20px; }
              .welcome-message { margin-bottom: 30px; }
              .welcome-message h2 { color: #1f2937; margin: 0 0 16px 0; font-size: 24px; }
              .welcome-message p { color: #6b7280; line-height: 1.6; margin: 0; }
              .credentials-box { background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 30px 0; }
              .credentials-box h3 { color: #1f2937; margin: 0 0 16px 0; font-size: 18px; }
              .credential-item { margin-bottom: 12px; }
              .credential-label { color: #6b7280; font-size: 14px; margin-bottom: 4px; }
              .credential-value { color: #1f2937; font-weight: 600; font-family: 'Monaco', 'Menlo', monospace; background-color: white; padding: 8px 12px; border-radius: 4px; border: 1px solid #d1d5db; }
              .property-info { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 30px 0; }
              .property-info h3 { color: #1e40af; margin: 0 0 12px 0; font-size: 16px; }
              .property-info p { color: #1e40af; margin: 0; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #1A73E8 0%, #1557B0 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .security-note { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 30px 0; }
              .security-note h4 { color: #92400e; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; }
              .security-note p { color: #92400e; margin: 0; font-size: 14px; }
              .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { color: #6b7280; margin: 0; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏠 Zira Homes</h1>
                <p>Modern Rental Management</p>
              </div>
              
              <div class="content">
                <div class="welcome-message">
                  <h2>Welcome, ${tenantName}!</h2>
                  <p>We're excited to have you as a tenant at ${propertyName}. Your tenant portal account has been created and you now have access to manage your rental experience online.</p>
                </div>

                <div class="property-info">
                  <h3>📍 Your Property Details</h3>
                  <p><strong>Property:</strong> ${propertyName}</p>
                  <p><strong>Unit:</strong> ${unitNumber}</p>
                </div>

                <div class="credentials-box">
                  <h3>🔑 Your Login Credentials</h3>
                  <div class="credential-item">
                    <div class="credential-label">Email Address:</div>
                    <div class="credential-value">${tenantEmail}</div>
                  </div>
                  <div class="credential-item">
                    <div class="credential-label">Temporary Password:</div>
                    <div class="credential-value">${temporaryPassword}</div>
                  </div>
                </div>

                <div style="text-align: center;">
                  <a href="${loginUrl}" class="cta-button">Access Your Tenant Portal</a>
                </div>

                <div class="security-note">
                  <h4>🔒 Important Security Notice</h4>
                  <p>Please change your temporary password after your first login for security purposes. You can update your password in the Profile section of your tenant portal.</p>
                </div>

                <div style="margin: 30px 0;">
                  <h3 style="color: #1f2937; margin-bottom: 16px;">🎯 What You Can Do in Your Portal:</h3>
                  <ul style="color: #6b7280; line-height: 1.8;">
                    <li><strong>View & Pay Rent:</strong> Check your balance and make payments online</li>
                    <li><strong>Submit Maintenance Requests:</strong> Report issues and track progress</li>
                    <li><strong>Access Lease Information:</strong> View your lease terms and documents</li>
                    <li><strong>Receive Announcements:</strong> Stay updated with property news</li>
                    <li><strong>Manage Profile:</strong> Update your contact information</li>
                  </ul>
                </div>

                <div style="margin: 30px 0; padding: 20px; background-color: #f0fdf4; border: 1px solid #16a34a; border-radius: 8px;">
                  <h4 style="color: #16a34a; margin: 0 0 8px 0;">📞 Need Help?</h4>
                  <p style="color: #16a34a; margin: 0; font-size: 14px;">
                    If you have any questions or need assistance, contact our support team at <strong>support@ziratech.com</strong> or call <strong>+254 757 878 023</strong>
                  </p>
                </div>
              </div>

              <div class="footer">
                <p>© 2024 Zira Homes. All rights reserved.</p>
                <p>This email was sent to ${tenantEmail}</p>
                <p style="margin-top:8px; font-size:12px; color:#6b7280;">
                  Can't find this email in your inbox? Please check your Spam/Junk folder or the Updates/Promotions tab and mark it as "Not spam" to ensure future delivery.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResponse.error?.message || "Failed to send welcome email",
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

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
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
