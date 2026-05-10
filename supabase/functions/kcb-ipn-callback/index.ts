import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[KCB-IPN-CALLBACK] ${step}${detailsStr}`);
};

// Normalize unit number for matching
function normalizeUnitNumber(unitNumber: string): string {
  return unitNumber.trim().toLowerCase().replace(/\s+/g, '');
}

// Resolve by unit number (TILLNUMBER-UNITNUMBER format)
async function resolveByUnitNumber(
  supabase: any,
  billRefNumber: string,
  amount: number
): Promise<{ 
  landlordId: string | null; 
  invoiceId: string | null; 
  invoice: any; 
  matchType: string;
  lease: any;
}> {
  let landlordId: string | null = null;
  let invoiceId: string | null = null;
  let invoice: any = null;
  let matchType = 'none';
  let lease: any = null;

  if (!billRefNumber) {
    return { landlordId, invoiceId, invoice, matchType, lease };
  }

  logStep('Resolving by unit number from bill ref:', billRefNumber);

  // Parse TILLNUMBER-UNITNUMBER format
  let tillNumber: string | null = null;
  let unitNumber: string = billRefNumber;

  if (billRefNumber.includes('-')) {
    const parts = billRefNumber.split('-');
    tillNumber = parts[0];
    unitNumber = parts.slice(1).join('-');
  }

  logStep('Parsed:', { tillNumber, unitNumber });

  // Step 1: Find landlord by till number (merchant_code in landlord_bank_configs)
  if (tillNumber) {
    const { data: landlordConfig, error: configError } = await supabase
      .from('landlord_bank_configs')
      .select('landlord_id')
      .eq('merchant_code', tillNumber)
      .eq('bank_code', 'kcb')
      .eq('is_active', true)
      .single();

    if (!configError && landlordConfig) {
      landlordId = landlordConfig.landlord_id;
      logStep('Found landlord by till number:', landlordId);
    } else {
      logStep('No landlord found for till number:', tillNumber);
      return { landlordId, invoiceId, invoice, matchType: 'no_merchant', lease };
    }
  }

  // Step 2: Find unit by unit number (within landlord's properties)
  let unitQuery = supabase
    .from('units')
    .select(`
      id,
      unit_number,
      properties!inner(
        id,
        owner_id,
        name
      )
    `)
    .ilike('unit_number', unitNumber);

  if (landlordId) {
    unitQuery = unitQuery.eq('properties.owner_id', landlordId);
  }

  const { data: units, error: unitError } = await unitQuery;

  if (unitError || !units || units.length === 0) {
    logStep('No unit found for unit number:', unitNumber);
    return { landlordId, invoiceId, invoice, matchType: 'no_unit', lease };
  }

  const unit = units[0];
  if (!landlordId) {
    landlordId = unit.properties?.owner_id || null;
  }

  logStep('Found unit:', unit.id, 'for property:', unit.properties?.name);

  // Step 3: Find active lease for this unit
  const { data: leases, error: leaseError } = await supabase
    .from('leases')
    .select(`id, tenant_id, monthly_rent, status`)
    .eq('unit_id', unit.id)
    .eq('status', 'active')
    .limit(1);

  if (leaseError || !leases || leases.length === 0) {
    logStep('No active lease found for unit:', unit.id);
    return { landlordId, invoiceId, invoice, matchType: 'no_lease', lease };
  }

  lease = leases[0];
  logStep('Found active lease:', lease.id, 'for tenant:', lease.tenant_id);

  // Step 4: Find pending invoices for this tenant/lease
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select(`id, tenant_id, lease_id, invoice_number, amount, status, due_date`)
    .eq('lease_id', lease.id)
    .eq('status', 'pending')
    .order('due_date', { ascending: true });

  if (invoicesError || !invoices || invoices.length === 0) {
    logStep('No pending invoices found for lease:', lease.id);
    return { landlordId, invoiceId, invoice, matchType: 'no_pending_invoices', lease };
  }

  logStep('Found', invoices.length, 'pending invoices');

  // Step 5: Match by amount or take oldest pending invoice
  if (invoices.length === 1) {
    invoice = invoices[0];
    invoiceId = invoice.id;
    matchType = 'unit_single_invoice';
    logStep('Single pending invoice matched:', invoiceId);
  } else {
    const exactMatch = invoices.find((inv: any) => parseFloat(inv.amount) === parseFloat(amount.toString()));
    
    if (exactMatch) {
      invoice = exactMatch;
      invoiceId = exactMatch.id;
      matchType = 'unit_amount_match';
      logStep('Invoice matched by exact amount:', invoiceId);
    } else {
      invoice = invoices[0];
      invoiceId = invoice.id;
      matchType = 'unit_oldest_invoice';
      logStep('Using oldest pending invoice:', invoiceId);
    }
  }

  return { landlordId, invoiceId, invoice, matchType, lease };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip')?.trim() || 
                     req.headers.get('cf-connecting-ip')?.trim() ||
                     'unknown';
    
    logStep('=== KCB IPN CALLBACK RECEIVED ===');
    logStep('KCB IPN from IP:', clientIP);

    const rawBody = await req.text();
    logStep('Raw body:', rawBody);

    let ipnData: any;
    try {
      ipnData = JSON.parse(rawBody);
    } catch (e) {
      logStep('Failed to parse JSON, trying form data');
      // Handle form-encoded data if needed
      ipnData = Object.fromEntries(new URLSearchParams(rawBody));
    }

    logStep('Parsed IPN Data:', JSON.stringify(ipnData, null, 2));

    // Handle both STK callback and C2B callback formats
    // STK Push callback format
    let transactionAmount = 0;
    let transactionId = '';
    let transactionDate = '';
    let phoneNumber = '';
    let billRefNumber = '';
    let resultCode = 0;
    let resultDesc = '';
    let checkoutRequestId = '';
    let merchantRequestId = '';

    if (ipnData.Body?.stkCallback) {
      // STK Push callback format
      const callback = ipnData.Body.stkCallback;
      checkoutRequestId = callback.CheckoutRequestID || '';
      merchantRequestId = callback.MerchantRequestID || '';
      resultCode = callback.ResultCode || 0;
      resultDesc = callback.ResultDesc || '';

      if (callback.CallbackMetadata?.Item) {
        for (const item of callback.CallbackMetadata.Item) {
          switch (item.Name) {
            case 'Amount':
              transactionAmount = parseFloat(item.Value) || 0;
              break;
            case 'MpesaReceiptNumber':
              transactionId = item.Value || '';
              break;
            case 'TransactionDate':
              transactionDate = item.Value?.toString() || '';
              break;
            case 'PhoneNumber':
              phoneNumber = item.Value?.toString() || '';
              break;
          }
        }
      }

      // Get bill ref from stored STK request
      const { data: stkRequest } = await supabase
        .from('mpesa_stk_requests')
        .select('account_reference')
        .eq('checkout_request_id', checkoutRequestId)
        .single();

      billRefNumber = stkRequest?.account_reference || '';

    } else if (ipnData.TransID || ipnData.transactionId) {
      // C2B callback format
      transactionId = ipnData.TransID || ipnData.transactionId || '';
      transactionAmount = parseFloat(ipnData.TransAmount || ipnData.amount) || 0;
      transactionDate = ipnData.TransTime || ipnData.transactionDate || new Date().toISOString();
      phoneNumber = ipnData.MSISDN || ipnData.phoneNumber || '';
      billRefNumber = ipnData.BillRefNumber || ipnData.billRefNumber || ipnData.accountReference || '';
      resultCode = 0; // C2B is always success if we receive it
      resultDesc = 'Success';
    } else {
      // Generic format
      transactionId = ipnData.transactionReference || ipnData.reference || `KCB${Date.now()}`;
      transactionAmount = parseFloat(ipnData.amount) || 0;
      transactionDate = ipnData.date || ipnData.transactionDate || new Date().toISOString();
      phoneNumber = ipnData.mobileNumber || ipnData.phone || '';
      billRefNumber = ipnData.billNumber || ipnData.accountReference || '';
      resultCode = ipnData.status === 'SUCCESS' ? 0 : 1;
      resultDesc = ipnData.message || ipnData.status || 'Unknown';
    }

    logStep('Extracted data:', {
      transactionId,
      transactionAmount,
      billRefNumber,
      phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'N/A',
      resultCode,
      resultDesc
    });

    // Try to match payment
    let landlordId: string | null = null;
    let invoiceId: string | null = null;
    let invoice: any = null;
    let matchType = 'none';
    let lease: any = null;

    if (resultCode === 0 && billRefNumber) {
      const unitResult = await resolveByUnitNumber(supabase, billRefNumber, transactionAmount);
      landlordId = unitResult.landlordId;
      invoiceId = unitResult.invoiceId;
      invoice = unitResult.invoice;
      matchType = unitResult.matchType;
      lease = unitResult.lease;
      logStep('Match result:', { matchType, invoiceId, landlordId });
    }

    // Store callback in bank_callbacks table
    const { data: callback, error: insertError } = await supabase
      .from('bank_callbacks')
      .insert({
        callback_type: 'kcb_ipn',
        bank_code: 'kcb',
        transaction_reference: transactionId || `KCB${Date.now()}`,
        amount: transactionAmount,
        status: resultCode === 0 ? 'SUCCESS' : 'FAILED',
        customer_mobile: phoneNumber,
        customer_reference: billRefNumber,
        transaction_date: transactionDate || new Date().toISOString(),
        landlord_id: landlordId,
        invoice_id: invoiceId,
        raw_payload: ipnData,
        ip_address: clientIP,
        processed: false,
        processing_notes: `Match type: ${matchType}, Result: ${resultDesc}`
      })
      .select()
      .single();

    if (insertError) {
      logStep('Error storing callback:', insertError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to store callback' 
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logStep('Callback stored:', callback.id, 'matchType:', matchType);

    // Process successful payments
    if (resultCode === 0 && invoiceId && invoice && lease) {
      logStep('Processing successful payment for invoice:', invoiceId);

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          tenant_id: invoice.tenant_id,
          lease_id: invoice.lease_id,
          invoice_id: invoiceId,
          amount: transactionAmount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'kcb_buni',
          payment_reference: transactionId,
          payment_type: 'rent',
          status: 'completed',
          transaction_id: transactionId,
          notes: `KCB Buni payment - ${matchType}`
        })
        .select()
        .single();

      if (paymentError) {
        logStep('Error creating payment:', paymentError);
      } else {
        logStep('Payment created:', payment.id);

        // Update invoice status
        const newStatus = transactionAmount >= parseFloat(invoice.amount) ? 'paid' : 'partial';
        await supabase
          .from('invoices')
          .update({ status: newStatus })
          .eq('id', invoiceId);

        logStep('Invoice updated to:', newStatus);

        // Mark callback as processed
        await supabase
          .from('bank_callbacks')
          .update({ 
            processed: true, 
            processed_at: new Date().toISOString(),
            payment_id: payment.id
          })
          .eq('id', callback.id);

        // Update mpesa_transactions if exists
        if (checkoutRequestId) {
          await supabase
            .from('mpesa_transactions')
            .update({
              status: 'completed',
              mpesa_receipt_number: transactionId,
              result_code: resultCode,
              result_desc: resultDesc
            })
            .eq('checkout_request_id', checkoutRequestId);
        }

        // Create notification for landlord
        if (landlordId) {
          await supabase
            .from('notifications')
            .insert({
              user_id: landlordId,
              title: 'Payment Received via KCB',
              message: `Payment of KES ${transactionAmount} received for invoice ${invoice.invoice_number}`,
              type: 'payment',
              related_id: payment.id,
              related_type: 'payment'
            });
        }
      }
    } else if (resultCode !== 0) {
      logStep('Payment failed:', resultDesc);
      
      // Update STK request status if applicable
      if (checkoutRequestId) {
        await supabase
          .from('mpesa_transactions')
          .update({
            status: 'failed',
            result_code: resultCode,
            result_desc: resultDesc
          })
          .eq('checkout_request_id', checkoutRequestId);
      }
    }

    // Return success to KCB
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Callback received',
      callbackId: callback.id
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logStep('ERROR:', { message: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
