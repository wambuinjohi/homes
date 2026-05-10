import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔔 send-overdue-reminders VERSION: 2025-11-12-v1.0 - Automated overdue invoice reminders');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate dates for 3 and 7 days ago
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    console.log('📅 Checking for overdue invoices:', {
      today: today.toISOString().split('T')[0],
      threeDaysAgo: threeDaysAgo.toISOString().split('T')[0],
      sevenDaysAgo: sevenDaysAgo.toISOString().split('T')[0]
    });

    // Find overdue invoices that need reminders
    const { data: overdueInvoices, error: queryError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        amount,
        due_date,
        status,
        tenant_id,
        lease_id,
        description,
        tenants!invoices_tenant_id_fkey (
          id,
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .eq('status', 'pending')
      .or(`due_date.eq.${threeDaysAgo.toISOString().split('T')[0]},due_date.eq.${sevenDaysAgo.toISOString().split('T')[0]}`)
      .order('due_date', { ascending: true });

    if (queryError) {
      console.error('❌ Error querying overdue invoices:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query overdue invoices' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${overdueInvoices?.length || 0} overdue invoices`);

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No overdue invoices requiring reminders',
          processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each overdue invoice
    let remindersProcessed = 0;
    let remindersSent = 0;
    let remindersFailed = 0;

    for (const invoice of overdueInvoices) {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let reminderType: '3_days' | '7_days' | null = null;
      if (daysOverdue === 3) {
        reminderType = '3_days';
      } else if (daysOverdue === 7) {
        reminderType = '7_days';
      }

      if (!reminderType) {
        console.log(`⏭️ Skipping invoice ${invoice.invoice_number} - ${daysOverdue} days overdue (not 3 or 7)`);
        continue;
      }

      console.log(`🔍 Processing invoice ${invoice.invoice_number} - ${daysOverdue} days overdue (${reminderType})`);

      // Check if reminder already sent
      const { data: existingReminder } = await supabase
        .from('invoice_overdue_reminders')
        .select('id')
        .eq('invoice_id', invoice.id)
        .eq('reminder_type', reminderType)
        .maybeSingle();

      if (existingReminder) {
        console.log(`✅ Reminder already sent for ${invoice.invoice_number} (${reminderType})`);
        continue;
      }

      remindersProcessed++;

      // Get tenant details
      const tenant = Array.isArray(invoice.tenants) ? invoice.tenants[0] : invoice.tenants;
      
      if (!tenant || !tenant.phone) {
        console.error(`❌ No phone number for tenant on invoice ${invoice.invoice_number}`);
        
        // Log failed reminder
        await supabase
          .from('invoice_overdue_reminders')
          .insert({
            invoice_id: invoice.id,
            tenant_id: invoice.tenant_id,
            reminder_type: reminderType,
            sms_status: 'failed',
            phone_number: null
          });
        
        remindersFailed++;
        continue;
      }

      // Prepare SMS message
      const tenantName = `${tenant.first_name} ${tenant.last_name}`.trim();
      const message = daysOverdue === 3
        ? `Hi ${tenantName}, your invoice ${invoice.invoice_number} for KES ${invoice.amount} is ${daysOverdue} days overdue. Please settle to avoid further charges. - Zira Homes`
        : `Hi ${tenantName}, URGENT: Your invoice ${invoice.invoice_number} for KES ${invoice.amount} is ${daysOverdue} days overdue. Please settle immediately to avoid penalties. - Zira Homes`;

      console.log(`📱 Sending SMS to ${tenant.phone} for invoice ${invoice.invoice_number}`);

      // Send SMS using send-sms function
      const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-sms', {
        body: {
          phone_number: tenant.phone,
          message: message
        }
      });

      const smsStatus = smsError ? 'failed' : 'sent';

      if (smsError) {
        console.error(`❌ Failed to send SMS for ${invoice.invoice_number}:`, smsError);
        remindersFailed++;
      } else {
        console.log(`✅ SMS sent successfully for ${invoice.invoice_number}`);
        remindersSent++;
      }

      // Log the reminder
      const { error: logError } = await supabase
        .from('invoice_overdue_reminders')
        .insert({
          invoice_id: invoice.id,
          tenant_id: invoice.tenant_id,
          reminder_type: reminderType,
          sms_status: smsStatus,
          phone_number: tenant.phone
        });

      if (logError) {
        console.error(`❌ Failed to log reminder for ${invoice.invoice_number}:`, logError);
      }
    }

    console.log('=== OVERDUE REMINDERS COMPLETED ===');
    console.log(`📊 Summary: ${remindersProcessed} processed, ${remindersSent} sent, ${remindersFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Overdue reminders processed',
        summary: {
          total_overdue: overdueInvoices.length,
          reminders_processed: remindersProcessed,
          reminders_sent: remindersSent,
          reminders_failed: remindersFailed
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Overdue reminders error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process overdue reminders',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
