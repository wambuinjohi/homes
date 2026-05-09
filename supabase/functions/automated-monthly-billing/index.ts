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

    console.log('Starting automated monthly billing process...');

    // Check if automated billing is enabled
    const { data: billingSettings } = await supabaseClient
      .from('automated_billing_settings')
      .select('*')
      .single();

    if (!billingSettings?.enabled) {
      console.log('Automated billing is disabled');
      return new Response(JSON.stringify({ 
        message: 'Automated billing is disabled',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current month date range
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Previous month for billing
    const billingMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const billingYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const billingPeriodStart = new Date(billingYear, billingMonth, 1);
    const billingPeriodEnd = new Date(billingYear, billingMonth + 1, 0);

    console.log(`Billing period: ${billingPeriodStart.toISOString().split('T')[0]} to ${billingPeriodEnd.toISOString().split('T')[0]}`);

    // Get all active landlords with subscriptions
    const { data: landlords } = await supabaseClient
      .from('landlord_subscriptions')
      .select(`
        landlord_id,
        billing_plan:billing_plans(*)
      `)
      .in('status', ['trial', 'active'])
      .not('billing_plan', 'is', null);

    if (!landlords || landlords.length === 0) {
      console.log('No active landlords found');
      return new Response(JSON.stringify({ 
        message: 'No active landlords found',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    const results = [];

    for (const landlord of landlords) {
      try {
        console.log(`Processing landlord: ${landlord.landlord_id}`);

        // Check if invoice already exists for this period
        const { data: existingInvoice } = await supabaseClient
          .from('service_charge_invoices')
          .select('id')
          .eq('landlord_id', landlord.landlord_id)
          .eq('billing_period_start', billingPeriodStart.toISOString().split('T')[0])
          .eq('billing_period_end', billingPeriodEnd.toISOString().split('T')[0])
          .single();

        if (existingInvoice) {
          console.log(`Invoice already exists for landlord ${landlord.landlord_id}`);
          continue;
        }

        // Get landlord's properties to calculate rent collected
        const { data: properties } = await supabaseClient
          .from('properties')
          .select('id')
          .or(`owner_id.eq.${landlord.landlord_id},manager_id.eq.${landlord.landlord_id}`);

        if (!properties || properties.length === 0) {
          console.log(`No properties found for landlord ${landlord.landlord_id}`);
          continue;
        }

        const propertyIds = properties.map(p => p.id);

        // Calculate rent collected from all tenant payments in the billing period
        const { data: rentPayments } = await supabaseClient
          .from('payments')
          .select(`
            amount,
            lease:leases!inner(
              unit:units!inner(
                property_id
              )
            )
          `)
          .in('lease.unit.property_id', propertyIds)
          .gte('payment_date', billingPeriodStart.toISOString().split('T')[0])
          .lte('payment_date', billingPeriodEnd.toISOString().split('T')[0])
          .eq('status', 'completed')
          .eq('payment_type', 'rent');

        const rentCollected = rentPayments?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;

        // Skip if no rent was collected
        if (rentCollected <= 0) {
          console.log(`No rent collected for landlord ${landlord.landlord_id}`);
          continue;
        }

        // Calculate SMS charges for the period
        const { data: smsUsage } = await supabaseClient
          .from('sms_usage')
          .select('cost')
          .eq('landlord_id', landlord.landlord_id)
          .gte('sent_at', billingPeriodStart.toISOString())
          .lte('sent_at', billingPeriodEnd.toISOString());

        const smsCharges = smsUsage?.reduce((sum, sms) => sum + Number(sms.cost), 0) || 0;

        // Get landlord's units for fixed/tiered pricing
        const { data: units } = await supabaseClient
          .from('units')
          .select('id')
          .in('property_id', propertyIds);

        const unitCount = units?.length || 0;

        // Calculate service charge based on billing plan
        const plan = landlord.billing_plan;
        let serviceChargeAmount = 0;
        
        if (plan.billing_model === 'percentage' && plan.percentage_rate) {
          // Commission-based: percentage of rent collected
          serviceChargeAmount = (rentCollected * plan.percentage_rate) / 100;
        } else if (plan.billing_model === 'fixed_per_unit' && plan.fixed_amount_per_unit) {
          // Fixed per unit: unit count × fixed amount
          serviceChargeAmount = unitCount * plan.fixed_amount_per_unit;
        } else if (plan.billing_model === 'tiered' && plan.tier_pricing) {
          // Tiered pricing: find applicable tier and calculate
          const tiers = Array.isArray(plan.tier_pricing) ? plan.tier_pricing : [];
          const applicableTier = tiers.find((tier: any) => 
            unitCount >= (tier.min_units || 0) && 
            (tier.max_units === null || unitCount <= tier.max_units)
          );
          
          if (applicableTier && applicableTier.price_per_unit) {
            serviceChargeAmount = unitCount * applicableTier.price_per_unit;
          }
        }

        console.log(`Billing calculation for landlord ${landlord.landlord_id}:`, {
          billing_model: plan.billing_model,
          unit_count: unitCount,
          rent_collected: rentCollected,
          service_charge: serviceChargeAmount,
          sms_charges: smsCharges
        });

        const totalAmount = serviceChargeAmount + smsCharges;

        // Skip if total amount is too small
        if (totalAmount < 10) {
          console.log(`Total amount too small for landlord ${landlord.landlord_id}: ${totalAmount}`);
          continue;
        }

        // Generate invoice using existing function
        const { data: generatedInvoice, error: invoiceError } = await supabaseClient.functions.invoke(
          'generate-service-invoice',
          {
            body: {
              landlord_id: landlord.landlord_id,
              billing_period_start: billingPeriodStart.toISOString().split('T')[0],
              billing_period_end: billingPeriodEnd.toISOString().split('T')[0]
            }
          }
        );

        if (invoiceError) {
          console.error(`Failed to generate invoice for landlord ${landlord.landlord_id}:`, invoiceError);
          results.push({
            landlord_id: landlord.landlord_id,
            success: false,
            error: invoiceError.message
          });
          continue;
        }

        // Send notification to landlord about new invoice
        const { error: notificationError } = await supabaseClient
          .from('notifications')
          .insert({
            user_id: landlord.landlord_id,
            type: 'billing',
            title: 'New Service Charge Invoice',
            message: `Your service charge invoice for ${billingPeriodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} is ready. Amount: KES ${totalAmount.toLocaleString()}`,
            related_type: 'service_charge_invoice',
            related_id: generatedInvoice.invoice.id
          });

        if (notificationError) {
          console.error(`Failed to send notification to landlord ${landlord.landlord_id}:`, notificationError);
        }

        processedCount++;
        results.push({
          landlord_id: landlord.landlord_id,
          success: true,
          invoice_id: generatedInvoice.invoice.id,
          amount: totalAmount,
          rent_collected: rentCollected
        });

        console.log(`Successfully processed landlord ${landlord.landlord_id}: KES ${totalAmount}`);

      } catch (error) {
        console.error(`Error processing landlord ${landlord.landlord_id}:`, error);
        results.push({
          landlord_id: landlord.landlord_id,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`Automated billing completed. Processed ${processedCount} landlords.`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Automated billing completed. Processed ${processedCount} landlords.`,
      processed: processedCount,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in automated monthly billing:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});