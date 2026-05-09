import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import React from 'npm:react@18.3.1';
import { TrialReminderEmail } from './_templates/trial-reminder.tsx';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrialUser {
  landlord_id: string;
  email: string;
  first_name: string;
  last_name: string;
  trial_end_date: string;
  status: string;
  days_remaining: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Starting trial reminder service...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all trial users
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('landlord_subscriptions')
      .select(`
        landlord_id,
        status,
        trial_end_date,
        profiles!landlord_subscriptions_landlord_id_fkey(email, first_name, last_name)
      `)
      .in('status', ['trial', 'trial_expired', 'suspended']);

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError);
      throw subscriptionsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('📝 No trial users found to process');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No trial users to process',
        processed: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Found ${subscriptions.length} trial users to process`);

    const emailsSent = [];
    const errors = [];

    for (const subscription of subscriptions) {
      try {
        const profile = subscription.profiles as any;
        if (!profile?.email) {
          console.log(`⚠️ Skipping user ${subscription.landlord_id} - no email found`);
          continue;
        }

        const now = new Date();
        const trialEndDate = new Date(subscription.trial_end_date);
        const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let reminderType = '';
        let shouldSend = false;

        // Determine which reminder to send based on days remaining and status
        if (subscription.status === 'trial') {
          if (daysRemaining === 7) {
            reminderType = 'trial_reminder_7_days';
            shouldSend = true;
          } else if (daysRemaining === 3) {
            reminderType = 'trial_reminder_3_days';
            shouldSend = true;
          } else if (daysRemaining === 1) {
            reminderType = 'trial_reminder_1_day';
            shouldSend = true;
          } else if (daysRemaining <= 0) {
            reminderType = 'trial_expired';
            shouldSend = true;
          }
        } else if (subscription.status === 'trial_expired') {
          // Grace period reminders
          const gracePeriodDays = Math.abs(daysRemaining);
          if (gracePeriodDays >= 1 && gracePeriodDays <= 7) {
            reminderType = 'grace_period_reminder';
            shouldSend = true;
          }
        } else if (subscription.status === 'suspended') {
          reminderType = 'account_suspended';
          shouldSend = true;
        }

        if (!shouldSend) {
          console.log(`⏭️ Skipping user ${profile.email} - no reminder needed (${daysRemaining} days remaining, status: ${subscription.status})`);
          continue;
        }

        // Check if we already sent this reminder type today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingLog } = await supabase
          .from('email_logs')
          .select('id')
          .eq('recipient_email', profile.email)
          .eq('template_type', reminderType)
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lt('created_at', `${today}T23:59:59.999Z`)
          .single();

        if (existingLog) {
          console.log(`📧 Already sent ${reminderType} to ${profile.email} today`);
          continue;
        }

        console.log(`📤 Sending ${reminderType} to ${profile.email} (${daysRemaining} days remaining)`);

        // Generate the email HTML
        const html = await renderAsync(
          React.createElement(TrialReminderEmail, {
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            daysRemaining: Math.max(0, daysRemaining),
            trialEndDate: trialEndDate.toLocaleDateString(),
            reminderType: reminderType as any,
            upgradeUrl: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://app.zirahomes.com'}/landlord/billing`
          })
        );

        // Get subject from template
        const subjects = {
          'trial_reminder_7_days': 'Your trial expires in 7 days - Don\'t lose access!',
          'trial_reminder_3_days': 'Only 3 days left in your trial',
          'trial_reminder_1_day': 'Last day of your trial - Upgrade now!',
          'trial_expired': 'Trial expired - Limited time to upgrade',
          'grace_period_reminder': 'Grace period ending soon - Upgrade required',
          'account_suspended': 'Account suspended - Upgrade to restore access'
        };

        const subject = subjects[reminderType as keyof typeof subjects] || 'Zira Homes Trial Update';

        // Send email via Resend
        const rawFromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "support@ziratech.com";
        const rawFromName = Deno.env.get("RESEND_FROM_NAME") || "Zira Technologies";
        const fromAddress = rawFromAddress.trim().replace(/^['"]|['"]$/g, "");
        const fromName = rawFromName.trim().replace(/^['"]|['"]$/g, "");
        const from = `${fromName} <${fromAddress}>`;

        const { data: emailResult, error: emailError } = await resend.emails.send({
          from: from,
          to: [profile.email],
          subject: subject,
          html: html,
        });

        if (emailError) {
          console.error(`❌ Failed to send email to ${profile.email}:`, emailError);
          errors.push({
            email: profile.email,
            reminderType,
            error: emailError.message
          });

          // Log failed email
          await supabase.from('email_logs').insert({
            recipient_email: profile.email,
            recipient_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            subject: subject,
            template_type: reminderType,
            status: 'failed',
            error_message: emailError.message,
            provider: 'resend'
          });

          continue;
        }

        console.log(`✅ Successfully sent ${reminderType} to ${profile.email}`);
        emailsSent.push({
          email: profile.email,
          reminderType,
          daysRemaining,
          emailId: emailResult?.id
        });

        // Log successful email
        await supabase.from('email_logs').insert({
          recipient_email: profile.email,
          recipient_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          subject: subject,
          template_type: reminderType,
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider: 'resend',
          metadata: { resend_id: emailResult?.id, days_remaining: daysRemaining }
        });

      } catch (userError) {
        console.error(`❌ Error processing user ${subscription.landlord_id}:`, userError);
        errors.push({
          userId: subscription.landlord_id,
          error: userError.message
        });
      }
    }

    console.log(`📊 Trial reminder service completed:
    - Processed: ${subscriptions.length} users
    - Emails sent: ${emailsSent.length}
    - Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Trial reminder service completed',
      stats: {
        totalProcessed: subscriptions.length,
        emailsSent: emailsSent.length,
        errors: errors.length
      },
      emailsSent,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Trial reminder service error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);