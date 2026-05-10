import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[KCB-STK-PUSH] ${step}${detailsStr}`);
};

// Get OAuth token from KCB Buni
async function getKCBToken(consumerKey: string, consumerSecret: string, environment: string): Promise<string> {
  const baseUrl = environment === 'production' 
    ? 'https://buni.kcbgroup.com'
    : 'https://uat.buni.kcbgroup.com';
  
  const credentials = base64Encode(new TextEncoder().encode(`${consumerKey}:${consumerSecret}`));
  
  logStep('Requesting OAuth token', { baseUrl, environment });
  
  const response = await fetch(`${baseUrl}/token?grant_type=client_credentials`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    logStep('OAuth token request failed', { status: response.status, error: errorText });
    throw new Error(`Failed to get KCB OAuth token: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  logStep('OAuth token obtained successfully');
  return data.access_token;
}

// Format phone number to 254 format
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.toString().replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  } else if (cleaned.startsWith('+254')) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

// Simple decryption helper
function decrypt(encrypted: string, encryptionKey: string): string {
  if (!encrypted) return '';
  try {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length));
    }
    return result;
  } catch {
    return encrypted; // Return as-is if decryption fails (backwards compatibility)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('KCB STK Push request started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Authenticate user
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', errorId: 'AUTH_MISSING_TOKEN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(token);
    
    if (authError || !user) {
      logStep('Authentication failed', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Invalid authentication', errorId: 'AUTH_INVALID_JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logStep('User authenticated', { userId: user.id });
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Parse request
    const { phone, amount, invoiceId, accountReference, transactionDesc, landlordId } = await req.json();
    
    logStep('Request parsed', {
      phone: phone ? `***${phone.toString().slice(-4)}` : 'missing',
      amount,
      invoiceId,
      accountReference,
      landlordId
    });
    
    if (!phone || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve landlord ID from invoice if not provided
    let resolvedLandlordId = landlordId;
    let invoice = null;
    
    if (invoiceId && !resolvedLandlordId) {
      const { data: invoiceData } = await supabaseAdmin
        .from('invoices')
        .select(`
          id, tenant_id, lease_id, invoice_number, amount, status,
          leases!invoices_lease_id_fkey!inner(
            unit_id,
            units!leases_unit_id_fkey!inner(
              property_id,
              properties!units_property_id_fkey!inner(owner_id)
            )
          )
        `)
        .eq('id', invoiceId)
        .single();
      
      if (invoiceData) {
        invoice = invoiceData;
        resolvedLandlordId = invoiceData.leases?.units?.properties?.owner_id;
        logStep('Resolved landlord from invoice', { landlordId: resolvedLandlordId });
      }
    }
    
    if (!resolvedLandlordId) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve landlord configuration' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get KCB config for landlord from landlord_bank_configs
    const { data: kcbConfig, error: configError } = await supabaseAdmin
      .from('landlord_bank_configs')
      .select('*')
      .eq('landlord_id', resolvedLandlordId)
      .eq('bank_code', 'kcb')
      .eq('is_active', true)
      .single();
    
    if (configError || !kcbConfig) {
      logStep('No KCB config found', { landlordId: resolvedLandlordId, error: configError?.message });
      return new Response(
        JSON.stringify({ 
          error: 'KCB Buni is not configured for this landlord',
          errorId: 'KCB_NOT_CONFIGURED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logStep('KCB config found', {
      merchantCode: kcbConfig.merchant_code,
      environment: kcbConfig.environment,
      credentialsVerified: kcbConfig.credentials_verified
    });
    
    // Decrypt credentials
    const encryptionKey = Deno.env.get('DATA_ENCRYPTION_KEY') || Deno.env.get('MPESA_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    const consumerKey = decrypt(kcbConfig.api_key_encrypted || '', encryptionKey);
    const consumerSecret = decrypt(kcbConfig.consumer_secret_encrypted || '', encryptionKey);
    
    if (!consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'KCB API credentials not configured',
          errorId: 'KCB_CREDENTIALS_MISSING'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get OAuth token
    const accessToken = await getKCBToken(consumerKey, consumerSecret, kcbConfig.environment || 'sandbox');
    
    // Prepare STK Push request
    const formattedPhone = formatPhoneNumber(phone);
    const merchantRequestId = `KCB${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const billNumber = invoice?.invoice_number || accountReference || merchantRequestId;
    const tillNumber = kcbConfig.merchant_code || '';
    
    // Build invoice number as TILLNUMBER-INVOICEREF
    const invoiceNumber = `${tillNumber}-${billNumber}`;
    
    const baseUrl = kcbConfig.environment === 'production'
      ? 'https://buni.kcbgroup.com'
      : 'https://uat.buni.kcbgroup.com';
    
    const callbackUrl = `${supabaseUrl}/functions/v1/kcb-ipn-callback`;
    
    const stkPayload = {
      phoneNumber: formattedPhone,
      amount: numAmount.toString(),
      invoiceNumber: invoiceNumber,
      sharedShortCode: true,
      orgShortCode: '522522',
      callbackUrl: callbackUrl,
      transactionDescription: transactionDesc || `Rent payment - ${billNumber}`
    };
    
    logStep('Sending STK Push request', { baseUrl, merchantRequestId, invoiceNumber });
    
    const stkResponse = await fetch(`${baseUrl}/mm/api/request/1.0.0/stkpush`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload)
    });
    
    const stkResult = await stkResponse.json();
    logStep('STK Push response', { status: stkResponse.status, result: stkResult });
    
    if (!stkResponse.ok) {
      const errorMsg = stkResult.message || stkResult.error || 'STK Push request failed';
      logStep('STK Push failed', { error: errorMsg });
      
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          errorId: 'KCB_STK_FAILED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const checkoutRequestId = stkResult.CheckoutRequestID || stkResult.checkoutRequestID || merchantRequestId;
    
    // Store the STK request for tracking
    await supabaseAdmin
      .from('mpesa_stk_requests')
      .insert({
        merchant_request_id: merchantRequestId,
        checkout_request_id: checkoutRequestId,
        phone_number: formattedPhone,
        amount: numAmount,
        account_reference: invoiceNumber,
        transaction_desc: transactionDesc || `KCB Buni - ${billNumber}`,
        invoice_id: invoiceId,
        landlord_id: resolvedLandlordId,
        provider: 'kcb',
        status: 'pending',
        response_code: stkResult.ResponseCode || '0',
        response_description: stkResult.ResponseDescription || 'Request accepted'
      });
    
    // Store in mpesa_transactions for tracking
    await supabaseAdmin
      .from('mpesa_transactions')
      .insert({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        phone_number: formattedPhone,
        amount: numAmount,
        invoice_id: invoiceId,
        provider: 'kcb',
        payment_type: 'rent',
        status: 'pending',
        initiated_by: user.id,
        metadata: {
          invoice_number: invoiceNumber,
          till_number: tillNumber,
          bill_number: billNumber
        }
      });
    
    logStep('STK Push initiated successfully', {
      merchantRequestId,
      checkoutRequestId,
      invoiceNumber
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK Push initiated successfully. Check your phone.',
        checkoutRequestId: checkoutRequestId,
        merchantRequestId: merchantRequestId,
        provider: 'kcb',
        paybillNumber: '522522',
        tillNumber: tillNumber,
        data: stkResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    logStep('ERROR', { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorId: 'KCB_STK_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
