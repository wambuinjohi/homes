import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 🔖 VERSION: 2026-01-19-v3.0 - Added idempotency + SMS automation settings check
  console.log('🚀 kopokopo-callback VERSION: 2026-01-19-v3.0 (idempotency + SMS settings)');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== KOPO KOPO CALLBACK RECEIVED ===');
    console.log('Request method:', req.method);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse callback data
    const callbackData = await req.json();
    console.log('Callback data:', JSON.stringify(callbackData, null, 2));

    // Extract data from Kopo Kopo callback structure
    const attributes = callbackData?.data?.attributes;
    if (!attributes) {
      console.error('❌ Invalid callback structure - missing data.attributes');
      return new Response(
        JSON.stringify({ error: 'Invalid callback structure' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = attributes.event || {};
    const resource = event.resource || {};
    const metadata = attributes.metadata || {};
    const status = attributes.status; // 'Success' or 'Failed'

    // Extract payment details
    const transactionId = resource.id || '';
    const reference = metadata.reference || '';
    const kopokopoReference = resource.reference || ''; // User-friendly receipt code (e.g., TKCLU9YGR2)
    const phoneNumber = resource.sender_phone_number || '';
    const amount = parseFloat(resource.amount || '0');
    const senderFirstName = resource.sender_first_name || '';
    const senderLastName = resource.sender_last_name || '';
    const invoiceId = metadata.invoice_id || '';
    const paymentType = metadata.payment_type || 'rent';
    const landlordId = metadata.landlord_id || '';

    // Get a unique identifier for this callback - prioritize kopokopoReference
    const callbackUniqueId = kopokopoReference || transactionId || reference;
    
    if (!callbackUniqueId) {
      console.error('❌ No unique identifier found in callback');
      return new Response(
        JSON.stringify({ error: 'Missing unique identifier' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 Payment Details:');
    console.log(`   Unique ID: ${callbackUniqueId}`);
    console.log(`   Status: ${status}`);
    console.log(`   Reference: ${reference}`);
    console.log(`   Kopo Kopo Reference: ${kopokopoReference}`);
    console.log(`   Transaction ID: ${transactionId}`);
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Amount: ${amount}`);
    console.log(`   Invoice ID: ${invoiceId}`);
    console.log(`   Payment Type: ${paymentType}`);

    // ============ IDEMPOTENCY CHECK ============
    // Check if this callback was already processed
    const { data: existingCallback } = await supabase
      .from('kopokopo_processed_callbacks')
      .select('id, processed_at')
      .eq('kopo_reference', callbackUniqueId)
      .maybeSingle();

    if (existingCallback) {
      console.log(`⚠️ IDEMPOTENCY: Callback ${callbackUniqueId} already processed at ${existingCallback.processed_at}`);
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          message: 'Already processed',
          processed_at: existingCallback.processed_at 
        }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also check if payment with this reference exists in payments table (notes field)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, created_at, payment_reference')
      .or(`notes.ilike.%${callbackUniqueId}%,payment_reference.eq.${transactionId}`)
      .limit(1)
      .maybeSingle();

    if (existingPayment) {
      console.log(`⚠️ IDEMPOTENCY: Payment already exists for ${callbackUniqueId}:`, existingPayment.id);
      
      // Record this callback as processed to prevent future retries
      await supabase
        .from('kopokopo_processed_callbacks')
        .insert({
          kopo_reference: callbackUniqueId,
          incoming_payment_id: transactionId,
          invoice_id: invoiceId || null,
          amount: amount,
          phone_number: phoneNumber
        });
      
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          message: 'Payment already recorded',
          payment_id: existingPayment.id 
        }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record this callback BEFORE processing to prevent race conditions
    const { error: recordError } = await supabase
      .from('kopokopo_processed_callbacks')
      .insert({
        kopo_reference: callbackUniqueId,
        incoming_payment_id: transactionId,
        invoice_id: invoiceId || null,
        amount: amount,
        phone_number: phoneNumber
      });

    if (recordError) {
      // If insert fails due to unique constraint, another request is processing
      if (recordError.code === '23505') {
        console.log(`⚠️ IDEMPOTENCY: Concurrent request detected for ${callbackUniqueId}`);
        return new Response(
          JSON.stringify({ status: 'ok', message: 'Already being processed' }), 
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Error recording callback:', recordError);
    }

    console.log('✅ Callback recorded for idempotency tracking:', callbackUniqueId);

    // Determine final status
    const statusLower = (status || '').toLowerCase();
    const successStatuses = ['success', 'successful', 'processed', 'completed', 'paid'];
    const isSuccess = successStatuses.includes(statusLower);
    
    const finalStatus = isSuccess ? 'completed' : 'failed';
    const resultCode = isSuccess ? 0 : 1;
    const resultDesc = isSuccess ? 'Payment successful' : (attributes.failure_reason || 'Payment failed');

    // Check if we should update existing transaction or insert new one
    let existingTxn = null;
    
    if (reference) {
      console.log('🔍 Looking for pending transaction with metadata.reference:', reference);
      const { data: allPending } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (allPending && allPending.length > 0) {
        existingTxn = allPending.find(tx => 
          tx.metadata && tx.metadata.reference === reference
        );
        
        if (existingTxn) {
          console.log('✅ Found pending transaction by reference match:', existingTxn.checkout_request_id);
        }
      }
    }
    
    // Fallback to invoice_id
    if (!existingTxn && invoiceId) {
      const { data } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        existingTxn = data;
        console.log('Found pending transaction by invoice_id:', existingTxn.checkout_request_id);
      }
    }

    if (existingTxn) {
      console.log('✅ Updating existing pending transaction:', existingTxn.checkout_request_id);
      
      const effectiveInvoiceId = invoiceId || existingTxn.invoice_id;
      
      const { error: updateError } = await supabase
        .from('mpesa_transactions')
        .update({
          result_code: resultCode,
          result_desc: resultDesc,
          mpesa_receipt_number: transactionId,
          phone_number: phoneNumber || existingTxn.phone_number,
          amount: amount || existingTxn.amount,
          status: finalStatus,
          provider: 'kopokopo',
          metadata: {
            ...existingTxn.metadata,
            provider: 'kopokopo',
            callback_reference: reference,
            kopo_reference: kopokopoReference,
            transaction_id: transactionId,
            sender_first_name: senderFirstName,
            sender_last_name: senderLastName,
            reconciled: true
          }
        })
        .eq('id', existingTxn.id);

      if (updateError) {
        console.error('❌ Failed to update transaction:', updateError);
      } else {
        console.log('✅ Transaction updated to', finalStatus);
      }
    } else {
      // Insert new transaction record
      console.log('⚠️  No existing pending transaction found, creating new record');
      const uniqueCheckoutId = `kk_cb_${transactionId || Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      
      const { error: transactionError } = await supabase
        .from('mpesa_transactions')
        .insert({
          merchant_request_id: reference || uniqueCheckoutId,
          checkout_request_id: uniqueCheckoutId,
          result_code: resultCode,
          result_desc: resultDesc,
          mpesa_receipt_number: transactionId,
          phone_number: phoneNumber,
          amount: amount,
          status: finalStatus,
          invoice_id: invoiceId || null,
          payment_type: paymentType || 'rent',
          provider: 'kopokopo',
          metadata: {
            provider: 'kopokopo',
            reference: reference,
            kopo_reference: kopokopoReference,
            transaction_id: transactionId,
            landlord_id: landlordId,
            sender_first_name: senderFirstName,
            sender_last_name: senderLastName,
            reconciled: false,
            note: 'Created from callback (no pending transaction found)'
          }
        });

      if (transactionError) {
        console.error('❌ Failed to insert transaction:', transactionError);
      } else {
        console.log('✅ Transaction record inserted');
      }
    }

    // If successful, update invoice and create payment record
    const finalInvoiceId = existingTxn?.invoice_id || invoiceId;
    
    if (finalStatus === 'completed' && finalInvoiceId) {
      console.log(`📝 Processing successful payment for invoice ${finalInvoiceId}`);

      // Update invoice status
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', finalInvoiceId);

      if (invoiceError) {
        console.error('❌ Failed to update invoice:', invoiceError);
      } else {
        console.log('✅ Invoice status updated to paid');
      }

      // Get invoice details for payment record
      const { data: invoice } = await supabase
        .from('invoices')
        .select('lease_id, tenant_id')
        .eq('id', finalInvoiceId)
        .single();

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: finalInvoiceId,
          lease_id: invoice?.lease_id,
          tenant_id: invoice?.tenant_id,
          amount: amount,
          payment_date: new Date().toISOString(),
          payment_method: 'mpesa_kopokopo',
          payment_type: paymentType || 'rent',
          status: 'completed',
          payment_reference: transactionId,
          transaction_id: transactionId,
          notes: `Kopo Kopo payment - ${kopokopoReference || 'N/A'}`
        });

      if (paymentError) {
        console.error('❌ Failed to create payment record:', paymentError);
      } else {
        console.log('✅ Payment record created');
      }

      // ============ CHECK SMS AUTOMATION SETTINGS ============
      let shouldSendSms = true;
      
      try {
        // Check global settings first, then landlord-specific
        const { data: smsSettings } = await supabase
          .from('sms_automation_settings')
          .select('enabled')
          .eq('automation_key', 'payment_receipt')
          .or(`landlord_id.eq.${landlordId},landlord_id.is.null`)
          .order('landlord_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (smsSettings && smsSettings.enabled === false) {
          console.log('📴 SMS automation disabled for payment_receipt');
          shouldSendSms = false;
        } else {
          console.log('📱 SMS automation enabled for payment_receipt');
        }
      } catch (settingsError) {
        console.error('Error checking SMS settings:', settingsError);
        // Default to sending SMS if settings check fails
      }

      // Send SMS receipt confirmation to tenant (if enabled)
      if (shouldSendSms) {
        try {
          const { data: invoiceData } = await supabase
            .from('invoices')
            .select('tenant_id')
            .eq('id', finalInvoiceId)
            .single();

          if (invoiceData?.tenant_id) {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('phone, first_name, last_name')
              .eq('id', invoiceData.tenant_id)
              .single();

            if (tenant?.phone) {
              const smsResponse = await supabase.functions.invoke('send-sms', {
                body: {
                  phone_number: tenant.phone,
                  message: `Payment of KES ${amount} received. Thank you! - Zira Homes. Receipt: ${kopokopoReference || transactionId.substring(0, 10)}`
                }
              });

              if (smsResponse.error) {
                console.error('❌ Error sending SMS receipt confirmation:', smsResponse.error);
              } else {
                console.log('✅ SMS receipt confirmation sent to:', tenant.phone);
              }
            }
          }
        } catch (smsError) {
          console.error('❌ Error in SMS receipt confirmation process:', smsError);
        }
      }
    } else if (finalStatus === 'failed') {
      console.log('❌ Payment failed - no further action taken');
    }

    console.log('=== KOPO KOPO CALLBACK PROCESSED SUCCESSFULLY ===');

    return new Response(
      JSON.stringify({ status: 'ok', message: 'Callback processed' }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Kopo Kopo callback error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Callback processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
