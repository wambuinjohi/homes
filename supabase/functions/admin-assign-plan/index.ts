import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-ASSIGN-PLAN] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const adminUser = userData.user;
    if (!adminUser) throw new Error("User not authenticated");
    logStep("Admin authenticated", { adminId: adminUser.id });

    // Verify admin role
    const { data: adminRole, error: roleError } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .eq('role', 'Admin')
      .single();

    if (roleError || !adminRole) {
      throw new Error("Unauthorized: Admin role required");
    }
    logStep("Admin role verified");

    const { landlordId, planId } = await req.json();
    if (!landlordId || !planId) {
      throw new Error("landlordId and planId are required");
    }
    logStep("Request parsed", { landlordId, planId });

    // Get the billing plan
    const { data: plan, error: planError } = await supabaseService
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error("Billing plan not found");
    }
    logStep("Plan retrieved", { planName: plan.name });

    // Update or create the landlord subscription (admin override)
    const { data: subscription, error: subscriptionError } = await supabaseService
      .from('landlord_subscriptions')
      .upsert({
        landlord_id: landlordId,
        billing_plan_id: planId,
        status: 'active',
        subscription_start_date: new Date().toISOString(),
        trial_end_date: null, // End trial when admin assigns a plan
        auto_renewal: true,
        sms_credits_balance: plan.sms_credits_included || 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'landlord_id'
      })
      .select();

    if (subscriptionError) {
      logStep("Subscription update failed", { 
        error: subscriptionError,
        code: subscriptionError.code,
        message: subscriptionError.message,
        details: subscriptionError.details
      });
      
      return new Response(JSON.stringify({ 
        success: false,
        error: subscriptionError.message,
        details: subscriptionError.details,
        hint: subscriptionError.hint
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("Subscription updated successfully", { subscriptionId: subscription?.[0]?.id });

    // Log the admin action
    await supabaseService.rpc('log_user_activity', {
      _user_id: adminUser.id,
      _action: 'admin_assign_plan',
      _entity_type: 'billing_plan',
      _entity_id: planId,
      _details: {
        landlord_id: landlordId,
        plan_name: plan.name,
        billing_model: plan.billing_model,
        percentage_rate: plan.percentage_rate,
        admin_override: true
      }
    });
    logStep("Admin action logged");

    return new Response(JSON.stringify({
      success: true,
      message: "Plan assigned successfully",
      subscription: subscription?.[0]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});