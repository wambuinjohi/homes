import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-BILLING-UPGRADE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started - M-Pesa confirmation");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");

    // Parse request to get M-Pesa transaction details
    const { checkoutRequestId, planId } = await req.json();
    if (!checkoutRequestId || !planId) {
      throw new Error("Checkout request ID and plan ID are required");
    }

    logStep("Parameters received", { checkoutRequestId, planId });

    // Verify M-Pesa transaction from mpesa_transactions table
    const { data: transaction, error: txnError } = await supabaseClient
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (txnError) {
      throw new Error(`Transaction not found: ${txnError.message}`);
    }

    logStep("M-Pesa transaction found", { 
      status: transaction.status, 
      amount: transaction.amount 
    });

    // Check if transaction is completed
    if (transaction.status !== 'completed') {
      throw new Error(`Payment not completed. Status: ${transaction.status}`);
    }

    // Get billing plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error("Billing plan not found");
    }

    logStep("Plan details retrieved", { planName: plan.name });

    // Verify transaction amount matches plan price
    if (transaction.amount !== plan.price) {
      throw new Error(`Amount mismatch. Expected: ${plan.price}, Got: ${transaction.amount}`);
    }

    // Update landlord subscription with plan
    const { data: subscription, error: subscriptionError } = await supabaseClient
      .from('landlord_subscriptions')
      .upsert({
        landlord_id: user.id,
        billing_plan_id: planId,
        status: 'active',
        subscription_start_date: new Date().toISOString(),
        trial_end_date: null, // End trial
        auto_renewal: true,
        sms_credits_balance: plan.sms_credits_included || 0,
        payment_method: 'mpesa',
        mpesa_receipt_number: transaction.mpesa_receipt_number,
        last_payment_date: new Date().toISOString()
      }, {
        onConflict: 'landlord_id'
      })
      .select();

    if (subscriptionError) {
      throw new Error(`Failed to update subscription: ${subscriptionError.message}`);
    }

    logStep("Subscription activated", { 
      subscriptionId: subscription[0]?.id,
      planName: plan.name 
    });

    // Create invoice for this payment
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`;
    const { error: invoiceError } = await supabaseClient
      .from('invoices')
      .insert({
        landlord_id: user.id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        amount: transaction.amount,
        status: 'paid',
        description: `Subscription upgrade to ${plan.name}`,
        payment_method: 'mpesa',
        mpesa_receipt_number: transaction.mpesa_receipt_number
      });

    if (invoiceError) {
      console.error("Warning: Failed to create invoice record:", invoiceError);
      // Don't throw - subscription is already activated
    }

    // Log activity
    await supabaseClient.rpc('log_user_activity', {
      _user_id: user.id,
      _action: 'subscription_upgrade',
      _entity_type: 'billing_plan',
      _entity_id: planId,
      _details: {
        plan_name: plan.name,
        payment_method: 'mpesa',
        mpesa_receipt: transaction.mpesa_receipt_number,
        amount: transaction.amount
      }
    }).catch(err => console.warn('Activity logging failed:', err));

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully upgraded to ${plan.name} plan`,
      subscription: subscription[0],
      plan: {
        id: plan.id,
        name: plan.name,
        billingModel: plan.billing_model
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
