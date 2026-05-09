import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  to: string;
  to_name: string;
  subject: string;
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
    // This function should only be called by internal services (send-notification)
    // Check for internal service authentication or restrict to localhost
    const userAgent = req.headers.get('user-agent') || '';
    const isInternalCall = userAgent.includes('supabase-functions') || 
                          req.headers.get('x-internal-service') === 'true';

    if (!isInternalCall) {
      // For external calls, require proper authentication
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
    }

    const { to, to_name, subject, title, message, type }: NotificationEmailRequest = await req.json();

    // Rate limiting for email sending
    const now = Date.now();
    // In production, implement proper rate limiting with Redis
    
    // Validate email address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log email sending with masked email (security)
    console.log('Sending email to:', to.replace(/(.{2})(.*)(@.*)/, '$1***$3'));

    const getTypeColor = (notificationType: string) => {
      switch (notificationType) {
        case 'payment': return '#10B981'; // green
        case 'lease': return '#3B82F6'; // blue
        case 'maintenance': return '#F59E0B'; // orange
        case 'system': return '#8B5CF6'; // purple
        case 'support': return '#6366F1'; // indigo
        default: return '#6B7280'; // gray
      }
    };

    const getTypeIcon = (notificationType: string) => {
      switch (notificationType) {
        case 'payment': return '💳';
        case 'lease': return '📋';
        case 'maintenance': return '🔧';
        case 'system': return '🔔';
        case 'support': return '💬';
        default: return '📧';
      }
    };

    const emailResponse = await resend.emails.send({
      from: `${Deno.env.get("RESEND_FROM_NAME") || "Zira Homes"} <${Deno.env.get("RESEND_FROM_ADDRESS") || "support@ziratech.com"}>`,
      to: [to],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f8f9fa;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .header {
              background-color: ${getTypeColor(type)};
              color: white;
              padding: 20px;
              text-align: center;
            }
            .content {
              padding: 30px;
            }
            .notification-type {
              display: inline-block;
              background-color: ${getTypeColor(type)}15;
              color: ${getTypeColor(type)};
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              margin-bottom: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: 600;
              margin: 0 0 15px 0;
              color: #1f2937;
            }
            .message {
              font-size: 16px;
              color: #4b5563;
              margin: 0 0 25px 0;
            }
            .footer {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .button {
              display: inline-block;
              background-color: ${getTypeColor(type)};
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div style="font-size: 32px; margin-bottom: 10px;">${getTypeIcon(type)}</div>
              <h1 style="margin: 0; font-size: 20px;">Property Notification</h1>
            </div>
            
            <div class="content">
              <div class="notification-type">${type}</div>
              <h2 class="title">${title}</h2>
              <p class="message">${message}</p>
              
              <a href="https://zira-homes-app.lovable.app/notifications" class="button">
                View in Portal
              </a>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from your property management system.</p>
              <p>If you no longer wish to receive these emails, you can update your notification preferences in your account settings.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
