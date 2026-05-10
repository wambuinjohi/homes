import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { landlord_id, billing_period_start, billing_period_end } = await req.json();

    // Get landlord subscription details
    const { data: subscription } = await supabaseClient
      .from('landlord_subscriptions')
      .select('*, billing_plan:billing_plans(*)')
      .eq('landlord_id', landlord_id)
      .single();

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Calculate rent collected in the period
    const { data: payments } = await supabaseClient
      .from('payments')
      .select('amount')
      .gte('payment_date', billing_period_start)
      .lte('payment_date', billing_period_end)
      .eq('status', 'completed');

    const rentCollected = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Calculate SMS usage costs for the period
    const { data: smsUsage } = await supabaseClient
      .from('sms_usage')
      .select('cost')
      .eq('landlord_id', landlord_id)
      .gte('sent_at', billing_period_start)
      .lte('sent_at', billing_period_end);

    const smsCharges = smsUsage?.reduce((sum, sms) => sum + Number(sms.cost), 0) || 0;

    // Calculate property expenses that should be passed to landlord
    const { data: landlordProperties } = await supabaseClient
      .from('properties')
      .select('id')
      .or(`owner_id.eq.${landlord_id},manager_id.eq.${landlord_id}`);

    const propertyIds = landlordProperties?.map(p => p.id) || [];
    
    let otherCharges = 0;
    if (propertyIds.length > 0) {
      // Get administrative expenses (security, water, maintenance, etc.)
      const { data: expenses } = await supabaseClient
        .from('expenses')
        .select('amount, category')
        .in('property_id', propertyIds)
        .gte('expense_date', billing_period_start)
        .lte('expense_date', billing_period_end)
        .in('category', ['Security', 'Water', 'Utilities', 'Administration', 'Insurance', 'Legal']);

      otherCharges = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
    }

    // Calculate service charge
    let serviceChargeAmount = 0;
    const plan = subscription.billing_plan;
    
    if (plan.billing_model === 'percentage' && plan.percentage_rate) {
      serviceChargeAmount = (rentCollected * plan.percentage_rate) / 100;
    }

    // Calculate total amount including all charges
    const totalAmount = serviceChargeAmount + smsCharges + otherCharges;

    // Generate invoice number
    const { data: invoiceNumber } = await supabaseClient
      .rpc('generate_service_invoice_number');

    // Create service charge invoice
    const { data: invoice, error } = await supabaseClient
      .from('service_charge_invoices')
      .insert({
        landlord_id,
        invoice_number: invoiceNumber,
        billing_period_start,
        billing_period_end,
        rent_collected: rentCollected,
        service_charge_rate: plan.percentage_rate,
        service_charge_amount: serviceChargeAmount,
        sms_charges: smsCharges,
        other_charges: otherCharges,
        total_amount: totalAmount,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        currency: plan.currency || 'KES'
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, invoice }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating service charge invoice:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});