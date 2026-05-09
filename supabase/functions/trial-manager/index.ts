import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { Resend } from "npm:resend@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrialNotification {
  landlord_id: string;
  email: string;
  first_name: string;
  last_name: string;
  days_remaining: number;
  template: any;
  subscription: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting trial management process...");

    // Get all active trial subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('landlord_subscriptions')
      .select(`
        *,
        profiles:landlord_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq('status', 'trial')
      .not('trial_end_date', 'is', null);

    if (subscriptionsError) {
      console.error("Error fetching subscriptions:", subscriptionsError);
      throw subscriptionsError;
    }

    console.log(`Found ${subscriptions?.length || 0} trial subscriptions to process`);

    const notifications: TrialNotification[] = [];
    const statusUpdates: any[] = [];

    // Process each subscription
    for (const subscription of subscriptions || []) {
      const trialEndDate = new Date(subscription.trial_end_date);
      const now = new Date();
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Processing subscription ${subscription.id}, days remaining: ${daysRemaining}`);

      // Check if trial has expired
      if (daysRemaining <= 0) {
        const gracePeriodEnd = new Date(trialEndDate.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        if (now > gracePeriodEnd) {
          // Suspend account after grace period
          statusUpdates.push({
            id: subscription.id,
            oldStatus: subscription.status,
            newStatus: 'suspended',
            reason: 'Grace period expired'
          });
        } else if (subscription.status === 'trial') {
          // Move to trial_expired status (grace period)
          statusUpdates.push({
            id: subscription.id,
            oldStatus: subscription.status,
            newStatus: 'trial_expired',
            reason: 'Trial period ended, entering grace period'
          });
        }
      }

      // Get notification templates for this stage
      const { data: templates } = await supabase
        .from('trial_notification_templates')
        .select('*')
        .eq('is_active', true)
        .eq('days_before_expiry', daysRemaining);

      // Add notifications for each matching template
      if (templates && templates.length > 0 && subscription.profiles) {
        for (const template of templates) {
          notifications.push({
            landlord_id: subscription.landlord_id,
            email: subscription.profiles.email,
            first_name: subscription.profiles.first_name,
            last_name: subscription.profiles.last_name,
            days_remaining: daysRemaining,
            template,
            subscription
          });
        }
      }
    }

    // Update subscription statuses
    for (const update of statusUpdates) {
      console.log(`Updating subscription ${update.id} from ${update.oldStatus} to ${update.newStatus}`);
      
      const { error: updateError } = await supabase
        .from('landlord_subscriptions')
        .update({ status: update.newStatus })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating subscription ${update.id}:`, updateError);
      } else {
        // Log status change
        await supabase.rpc('log_trial_status_change', {
          _landlord_id: update.landlord_id,
          _old_status: update.oldStatus,
          _new_status: update.newStatus,
          _reason: update.reason
        });
      }
    }

    // Send notifications
    for (const notification of notifications) {
      try {
        const upgradeUrl = `${supabaseUrl.replace('.supabase.co', '.vercel.app') || 'https://app.zirahomes.com'}/landlord/billing`;
        
        const htmlContent = notification.template.html_content
          .replace(/{{upgrade_url}}/g, upgradeUrl)
          .replace(/{{first_name}}/g, notification.first_name || '')
          .replace(/{{days_remaining}}/g, notification.days_remaining.toString());

        const emailContent = notification.template.email_content
          .replace(/{{upgrade_url}}/g, upgradeUrl)
          .replace(/{{first_name}}/g, notification.first_name || '')
          .replace(/{{days_remaining}}/g, notification.days_remaining.toString());

        console.log(`Sending notification to ${notification.email} for template ${notification.template.template_name}`);

        const rawFromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "support@ziratech.com";
        const rawFromName = Deno.env.get("RESEND_FROM_NAME") || "Zira Technologies";
        const fromAddress = rawFromAddress.trim().replace(/^['"]|['"]$/g, "");
        const fromName = rawFromName.trim().replace(/^['"]|['"]$/g, "");
        const from = `${fromName} <${fromAddress}>`;

        const emailResponse = await resend.emails.send({
          from,
          to: [notification.email],
          subject: notification.template.subject,
          html: htmlContent,
          text: emailContent,
        });

        console.log(`Email sent successfully:`, emailResponse);

        // Log the notification
        await supabase
          .from('email_logs')
          .insert({
            recipient_email: notification.email,
            recipient_name: `${notification.first_name} ${notification.last_name}`,
            subject: notification.template.subject,
            template_type: notification.template.template_name,
            status: 'sent',
            provider: 'resend',
            sent_at: new Date().toISOString(),
            metadata: {
              landlord_id: notification.landlord_id,
              days_remaining: notification.days_remaining,
              template_id: notification.template.id
            }
          });

      } catch (emailError) {
        console.error(`Error sending email to ${notification.email}:`, emailError);
        
        // Log failed notification
        await supabase
          .from('email_logs')
          .insert({
            recipient_email: notification.email,
            recipient_name: `${notification.first_name} ${notification.last_name}`,
            subject: notification.template.subject,
            template_type: notification.template.template_name,
            status: 'failed',
            provider: 'resend',
            error_message: emailError.message,
            metadata: {
              landlord_id: notification.landlord_id,
              days_remaining: notification.days_remaining,
              template_id: notification.template.id
            }
          });
      }
    }

    console.log(`Trial management completed. Processed ${subscriptions?.length || 0} subscriptions, sent ${notifications.length} notifications, updated ${statusUpdates.length} statuses.`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: subscriptions?.length || 0,
        notifications_sent: notifications.length,
        status_updates: statusUpdates.length,
        message: "Trial management completed successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in trial-manager function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);