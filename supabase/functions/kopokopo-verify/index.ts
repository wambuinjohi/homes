import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getKopokopoAccessToken, getKopokopoBaseUrl } from "../_shared/kopokopoAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔍 kopokopo-verify VERSION: 2025-11-12-v1.0 - On-demand payment reconciliation');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No valid authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    // Create user-scoped client for auth validation
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Initialize admin client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Parse request body
    const requestBody = await req.json();
    const { checkoutRequestId, reference } = requestBody;

    console.log('📋 Verify request:', { checkoutRequestId, reference });

    if (!checkoutRequestId && !reference) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: checkoutRequestId or reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Lookup the target transaction
    let transaction = null;
    
    if (checkoutRequestId) {
      console.log('🔍 Looking up transaction by checkout_request_id:', checkoutRequestId);
      const { data, error } = await supabaseAdmin
        .from('mpesa_transactions')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (error) {
        console.error('❌ Database query error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to lookup transaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      transaction = data;
    } else if (reference) {
      console.log('🔍 Looking up transaction by metadata.reference:', reference);
      const { data: allPending } = await supabaseAdmin
        .from('mpesa_transactions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      
      transaction = allPending?.find(tx => 
        tx.metadata && tx.metadata.reference === reference
      );
    }

    if (!transaction) {
      console.error('❌ No pending transaction found');
      return new Response(
        JSON.stringify({ 
          error: 'Transaction not found',
          hint: 'No pending Kopo Kopo transaction found with the provided identifier'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate it's a Kopo Kopo transaction
    if (transaction.provider !== 'kopokopo') {
      console.error('❌ Not a Kopo Kopo transaction:', transaction.provider);
      return new Response(
        JSON.stringify({ error: 'This verification is only for Kopo Kopo payments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Found pending Kopo Kopo transaction:', {
      id: transaction.id,
      checkout_request_id: transaction.checkout_request_id,
      created_at: transaction.created_at
    });

    // Step 2: Get incoming_payment_url from metadata
    const incomingPaymentUrl = transaction.metadata?.incoming_payment_url;
    
    if (!incomingPaymentUrl) {
      console.error('❌ Missing incoming_payment_url in transaction metadata');
      return new Response(
        JSON.stringify({ 
          error: 'Cannot verify payment',
          hint: 'Transaction is missing the incoming_payment_url needed for verification'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Found incoming_payment_url:', incomingPaymentUrl);

    // Step 3: Resolve landlord config for Kopo Kopo credentials
    let landlordId = transaction.metadata?.landlord_id || transaction.initiated_by;
    
    // If no landlord ID, try to resolve from invoice
    if (!landlordId && transaction.invoice_id) {
      console.log('🔍 Resolving landlord from invoice:', transaction.invoice_id);
      const { data: invoiceData } = await supabaseAdmin
        .from('invoices')
        .select(`
          lease_id,
          leases!invoices_lease_id_fkey!inner(
            unit_id,
            units!leases_unit_id_fkey!inner(
              property_id,
              properties!units_property_id_fkey!inner(owner_id)
            )
          )
        `)
        .eq('id', transaction.invoice_id)
        .single();

      if (invoiceData?.leases?.units?.properties?.owner_id) {
        landlordId = invoiceData.leases.units.properties.owner_id;
        console.log('✅ Resolved landlord from invoice:', landlordId);
      }
    }

    // Get Kopo Kopo config
    let kopokopoConfig = null;
    
    if (landlordId) {
      const { data: config } = await supabaseAdmin
        .from('landlord_mpesa_configs')
        .select('*')
        .eq('landlord_id', landlordId)
        .eq('is_active', true)
        .eq('shortcode_type', 'till')
        .maybeSingle();
      
      kopokopoConfig = config;
    }

    // Fallback to platform config if no landlord config
    if (!kopokopoConfig) {
      console.log('⚠️ No landlord config found, using platform config');
      const { data: platformConfig } = await supabaseAdmin
        .from('billing_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_mpesa_config')
        .single();

      if (platformConfig?.setting_value) {
        const mpesaConfig = platformConfig.setting_value as any;
        kopokopoConfig = {
          client_id: mpesaConfig.client_id,
          client_secret: mpesaConfig.client_secret,
          environment: mpesaConfig.environment || 'sandbox'
        };
      }
    }

    if (!kopokopoConfig || !kopokopoConfig.client_id || !kopokopoConfig.client_secret) {
      console.error('❌ No valid Kopo Kopo configuration found');
      return new Response(
        JSON.stringify({ error: 'Kopo Kopo configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: OAuth to Kopo Kopo
    console.log('🔐 Authenticating with Kopo Kopo...');
    const tokenResponse = await getKopokopoAccessToken(
      kopokopoConfig.client_id,
      kopokopoConfig.client_secret,
      kopokopoConfig.environment as 'sandbox' | 'production'
    );

    console.log('✅ Kopo Kopo OAuth successful');

    // Step 5: Query incoming payment URL
    console.log('🔍 Querying Kopo Kopo payment status:', incomingPaymentUrl);
    const paymentResponse = await fetch(incomingPaymentUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResponse.access_token}`,
        'Accept': 'application/json',
        'User-Agent': 'PropertyManagement/1.0 (Verify)'
      }
    });

    if (!paymentResponse.ok) {
      console.error('❌ Kopo Kopo API error:', paymentResponse.status, paymentResponse.statusText);
      const errorText = await paymentResponse.text();
      console.error('Error response:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to query payment status from Kopo Kopo',
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentData = await paymentResponse.json();
    console.log('📊 Kopo Kopo payment data:', JSON.stringify(paymentData, null, 2));

    // Step 6: Parse and map status
    const attributes = paymentData?.data?.attributes;
    if (!attributes) {
      console.error('❌ Invalid Kopo Kopo response structure');
      return new Response(
        JSON.stringify({ error: 'Invalid payment data from Kopo Kopo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = attributes.event || {};
    const resource = event.resource || {};
    const status = attributes.status; // 'Success', 'Processed', 'Failed', etc.

    // Map status to our format
    const statusLower = (status || '').toLowerCase();
    const successStatuses = ['success', 'successful', 'processed', 'completed', 'paid'];
    const isSuccess = successStatuses.includes(statusLower);

    const finalStatus = isSuccess ? 'completed' : 'failed';
    const resultCode = isSuccess ? 0 : 1;
    const resultDesc = isSuccess 
      ? 'Payment successful' 
      : (attributes.failure_reason || 'Payment failed');

    const transactionId = resource.id || '';
    const mpesaReceipt = transactionId;
    const phoneNumber = resource.sender_phone_number || transaction.phone_number;
    const amount = parseFloat(resource.amount || transaction.amount);

    console.log('📊 Mapped payment status:', {
      originalStatus: status,
      finalStatus,
      resultCode,
      resultDesc,
      transactionId
    });

    // Step 7: Update transaction in database
    console.log('💾 Updating transaction record...');
    
    const reconcileAttempts = (transaction.metadata?.reconcile_attempts || 0) + 1;
    
    const { error: updateError } = await supabaseAdmin
      .from('mpesa_transactions')
      .update({
        status: finalStatus,
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceipt,
        phone_number: phoneNumber,
        amount: amount,
        provider: 'kopokopo',
        metadata: {
          ...transaction.metadata,
          reconcile_attempts: reconcileAttempts,
          reconciled: true,
          reconciled_at: new Date().toISOString(),
          raw_verify_response: paymentData
        }
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('❌ Failed to update transaction:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Transaction updated successfully');

    // Step 8: If successful and has invoice, update invoice and create payment
    let invoiceUpdated = false;
    
    if (isSuccess && transaction.invoice_id) {
      console.log('📝 Processing successful payment for invoice:', transaction.invoice_id);

      // Update invoice status
      const { error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .update({ 
          status: 'paid'
        })
        .eq('id', transaction.invoice_id);

      if (invoiceError) {
        console.error('❌ Failed to update invoice:', invoiceError);
      } else {
        console.log('✅ Invoice status updated to paid');
        invoiceUpdated = true;
      }

      // Get invoice details for payment record
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('lease_id, tenant_id')
        .eq('id', transaction.invoice_id)
        .single();

      // Create payment record
      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          invoice_id: transaction.invoice_id,
          lease_id: invoice?.lease_id,
          tenant_id: invoice?.tenant_id,
          amount: amount,
          payment_date: new Date().toISOString(),
          payment_method: 'mpesa_kopokopo',
          payment_type: transaction.metadata?.paymentType || 'rent',
          status: 'completed',
          payment_reference: mpesaReceipt,
          transaction_id: mpesaReceipt,
          notes: `Kopo Kopo payment verified manually - ${resource.reference || 'N/A'}`
        });

      if (paymentError) {
        console.error('❌ Failed to create payment record:', paymentError);
      } else {
        console.log('✅ Payment record created');
      }
    }

    console.log('=== KOPO KOPO VERIFY COMPLETED ===');

    return new Response(
      JSON.stringify({
        status: finalStatus,
        result_code: resultCode,
        result_desc: resultDesc,
        receipt: mpesaReceipt,
        invoice_updated: invoiceUpdated,
        reconcile_attempts: reconcileAttempts,
        message: isSuccess 
          ? 'Payment verified successfully' 
          : 'Payment verification complete - payment failed'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Kopo Kopo verify error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
