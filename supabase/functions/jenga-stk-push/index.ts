import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[JENGA-STK-PUSH] ${step}${detailsStr}`);
};

// Generate RSA-SHA256 signature for Jenga API
async function generateSignature(data: string, privateKeyPem: string): Promise<string> {
  try {
    // Clean up PEM format
    const pemContents = privateKeyPem
      .replace('-----BEGIN RSA PRIVATE KEY-----', '')
      .replace('-----END RSA PRIVATE KEY-----', '')
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    
    // Decode base64 key
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    // Import the key
    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the data
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(data)
    );
    
    // Return base64 encoded signature
    return base64Encode(new Uint8Array(signature));
  } catch (error) {
    logStep('Signature generation failed', { error: error.message });
    throw new Error(`Failed to generate signature: ${error.message}`);
  }
}

// Get OAuth token from Jenga
async function getJengaToken(apiKey: string, consumerSecret: string, environment: string): Promise<string> {
  const baseUrl = environment === 'production' 
    ? 'https://api.finserve.africa'
    : 'https://uat.finserve.africa';
  
  const credentials = base64Encode(new TextEncoder().encode(`${apiKey}:${consumerSecret}`));
  
  logStep('Requesting OAuth token', { baseUrl, environment });
  
  const response = await fetch(`${baseUrl}/authentication/api/v3/authenticate/merchant`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    logStep('OAuth token request failed', { status: response.status, error: errorText });
    throw new Error(`Failed to get Jenga OAuth token: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  logStep('OAuth token obtained successfully');
  return data.accessToken || data.access_token;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Jenga STK Push request started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const jengaPrivateKey = Deno.env.get('JENGA_PRIVATE_KEY') ?? '';
    
    if (!jengaPrivateKey) {
      throw new Error('JENGA_PRIVATE_KEY not configured');
    }
    
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
    
    // Get Jenga config for landlord
    const { data: jengaConfig, error: configError } = await supabaseAdmin
      .from('landlord_jenga_configs')
      .select('*')
      .eq('landlord_id', resolvedLandlordId)
      .eq('is_active', true)
      .single();
    
    if (configError || !jengaConfig) {
      logStep('No Jenga config found', { landlordId: resolvedLandlordId, error: configError?.message });
      return new Response(
        JSON.stringify({ 
          error: 'Jenga PAY is not configured for this landlord',
          errorId: 'JENGA_NOT_CONFIGURED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logStep('Jenga config found', {
      merchantCode: jengaConfig.merchant_code,
      environment: jengaConfig.environment,
      credentialsVerified: jengaConfig.credentials_verified
    });
    
    // Decrypt credentials
    const encryptionKey = Deno.env.get('DATA_ENCRYPTION_KEY') || Deno.env.get('MPESA_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    // Simple decryption (should match encryption used in save function)
    const decrypt = (encrypted: string): string => {
      if (!encrypted) return '';
      try {
        // If it's base64 encoded encrypted data
        const decoded = atob(encrypted);
        // Simple XOR decryption with key
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
          result += String.fromCharCode(decoded.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length));
        }
        return result;
      } catch {
        // If decryption fails, assume it's already plain text (for backwards compatibility)
        return encrypted;
      }
    };
    
    const apiKey = decrypt(jengaConfig.api_key_encrypted || '');
    const consumerSecret = decrypt(jengaConfig.consumer_secret_encrypted || '');
    
    if (!apiKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'Jenga API credentials not configured',
          errorId: 'JENGA_CREDENTIALS_MISSING'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get OAuth token
    const accessToken = await getJengaToken(apiKey, consumerSecret, jengaConfig.environment);
    
    // Prepare STK Push request
    const formattedPhone = formatPhoneNumber(phone);
    const orderReference = `OR${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const paymentReference = `PAY${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const billNumber = invoice?.invoice_number || accountReference || orderReference;
    
    // Generate signature: orderReference+paymentCurrency+msisdn+paymentAmount
    const signatureData = `${orderReference}KES${formattedPhone}${numAmount}`;
    const signature = await generateSignature(signatureData, jengaPrivateKey);
    
    logStep('Signature generated', { signatureData, signatureLength: signature.length });
    
    const baseUrl = jengaConfig.environment === 'production'
      ? 'https://api.finserve.africa'
      : 'https://uat.finserve.africa';
    
    const callbackUrl = `${supabaseUrl}/functions/v1/jenga-ipn-callback`;
    
    const stkPayload = {
      order: {
        orderReference,
        orderAmount: numAmount,
        orderCurrency: 'KES',
        source: 'APICHECKOUT',
        countryCode: 'KE',
        description: transactionDesc || `Payment for ${billNumber}`
      },
      customer: {
        name: user.email?.split('@')[0] || 'Customer',
        email: user.email || 'customer@example.com',
        phoneNumber: formattedPhone,
        identityNumber: '00000000',
        firstAddress: '',
        secondAddress: ''
      },
      payment: {
        paymentReference,
        paymentCurrency: 'KES',
        channel: 'MOBILE',
        service: 'MPESA',
        provider: 'JENGA',
        callbackUrl,
        details: {
          msisdn: formattedPhone,
          paymentAmount: numAmount
        }
      }
    };
    
    logStep('Sending STK Push request', { baseUrl, orderReference, paymentReference });
    
    const stkResponse = await fetch(`${baseUrl}/api-checkout/mpesa-stk-push/v3.0/init`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Signature': signature
      },
      body: JSON.stringify(stkPayload)
    });
    
    const stkResult = await stkResponse.json();
    logStep('STK Push response', { status: stkResponse.status, result: stkResult });
    
    if (!stkResponse.ok || stkResult.status === false) {
      const errorMsg = stkResult.message || 'STK Push request failed';
      logStep('STK Push failed', { error: errorMsg, code: stkResult.code });
      
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          errorId: 'JENGA_STK_FAILED',
          code: stkResult.code
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Store the STK request for tracking
    await supabaseAdmin
      .from('mpesa_stk_requests')
      .insert({
        merchant_request_id: orderReference,
        checkout_request_id: paymentReference,
        phone_number: formattedPhone,
        amount: numAmount,
        account_reference: billNumber,
        transaction_desc: transactionDesc || `Jenga PAY - ${billNumber}`,
        invoice_id: invoiceId,
        landlord_id: resolvedLandlordId,
        provider: 'jenga',
        status: 'pending',
        response_code: stkResult.code,
        response_description: stkResult.message
      });
    
    // Store in mpesa_transactions for tracking
    await supabaseAdmin
      .from('mpesa_transactions')
      .insert({
        checkout_request_id: paymentReference,
        merchant_request_id: orderReference,
        phone_number: formattedPhone,
        amount: numAmount,
        invoice_id: invoiceId,
        provider: 'jenga',
        payment_type: 'rent',
        status: 'pending',
        initiated_by: user.id,
        metadata: {
          order_reference: orderReference,
          payment_reference: paymentReference,
          jenga_invoice_number: stkResult.data?.invoiceNumber,
          bill_number: billNumber
        }
      });
    
    logStep('STK Push initiated successfully', {
      orderReference,
      paymentReference,
      jengaInvoice: stkResult.data?.invoiceNumber
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK Push initiated successfully. Check your phone.',
        checkoutRequestId: paymentReference,
        merchantRequestId: orderReference,
        provider: 'jenga',
        tillNumber: jengaConfig.paybill_number || '247247',
        data: stkResult.data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    logStep('ERROR', { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorId: 'JENGA_STK_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
