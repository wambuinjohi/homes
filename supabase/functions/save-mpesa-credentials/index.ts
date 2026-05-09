import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secure encryption using AES-256-GCM with Deno's crypto API
async function encryptCredential(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Get encryption key from environment (Supabase secret)
  const encryptionKeyBase64 = Deno.env.get('MPESA_ENCRYPTION_KEY');
  if (!encryptionKeyBase64) {
    throw new Error('MPESA_ENCRYPTION_KEY environment variable not set');
  }
  
  // Decode the base64 key
  const keyData = Uint8Array.from(atob(encryptionKeyBase64), c => c.charCodeAt(0));
  
  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Generate random IV (initialization vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(plaintext)
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Create admin client for secure operations (uses service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      config_id,
      consumer_key,
      consumer_secret,
      shortcode,
      shortcode_type,
      passkey,
      till_number,
      till_provider,
      kopokopo_client_id,
      kopokopo_client_secret,
      callback_url,
      environment,
      is_active
    } = await req.json();

    // Validate shortcode_type
    if (shortcode_type && !['paybill', 'till_safaricom', 'till_kopokopo'].includes(shortcode_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid shortcode type. Must be "paybill", "till_safaricom", or "till_kopokopo"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields based on shortcode type
    if (shortcode_type === 'till_kopokopo') {
      // Kopo Kopo Till validation
      if (!till_number || !kopokopo_client_id || !kopokopo_client_secret) {
        return new Response(
          JSON.stringify({ error: 'Missing required Kopo Kopo credentials: till_number, client_id, client_secret' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (till_number.length < 5 || kopokopo_client_id.length < 10 || kopokopo_client_secret.length < 10) {
        return new Response(
          JSON.stringify({ error: 'Invalid Kopo Kopo credential format - credentials too short' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Standard M-Pesa validation (Paybill or Till Safaricom)
      if (!consumer_key || !consumer_secret || !shortcode || !passkey) {
        return new Response(
          JSON.stringify({ error: 'Missing required M-Pesa credentials: consumer_key, consumer_secret, shortcode, passkey' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (consumer_key.length < 10 || consumer_secret.length < 10 || 
          shortcode.length < 5 || passkey.length < 20) {
        return new Response(
          JSON.stringify({ error: 'Invalid M-Pesa credential format - credentials too short' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[MPESA-CREDS] Saving encrypted credentials for landlord: ${user.id}, type: ${shortcode_type}`);

    // SECURITY: Encrypt all sensitive credentials before storage
    let encryptedConsumerKey: string | null = null;
    let encryptedConsumerSecret: string | null = null;
    let encryptedPasskey: string | null = null;
    let encryptedKopokopoClientSecret: string | null = null;

    try {
      if (shortcode_type === 'till_kopokopo') {
        // Encrypt Kopo Kopo OAuth client secret
        encryptedKopokopoClientSecret = await encryptCredential(kopokopo_client_secret);
        console.log('[MPESA-CREDS] Kopo Kopo client secret encrypted successfully');
      } else {
        // Encrypt standard M-Pesa credentials
        encryptedConsumerKey = await encryptCredential(consumer_key);
        encryptedConsumerSecret = await encryptCredential(consumer_secret);
        encryptedPasskey = await encryptCredential(passkey);
        console.log('[MPESA-CREDS] M-Pesa credentials encrypted successfully');
      }
    } catch (encryptError) {
      console.error('[MPESA-CREDS] Encryption error:', encryptError);
      return new Response(
        JSON.stringify({ error: 'Failed to encrypt credentials - check server configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log security event BEFORE saving (for audit trail)
    try {
      // Safely compute shortcode prefix (may be undefined for till_kopokopo)
      const shortcodeValue = shortcode || till_number || '';
      const shortcodePrefix = shortcodeValue.length >= 3 
        ? shortcodeValue.substring(0, 3) + '***' 
        : '***';
      
      await supabaseAdmin.rpc('log_security_event', {
        _event_type: 'mpesa_credentials_save_attempt',
        _severity: 'high',
        _user_id: user.id,
        _ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        _user_agent: req.headers.get('user-agent') || 'unknown',
        _details: { 
          environment, 
          has_callback: !!callback_url,
          shortcode_prefix: shortcodePrefix,
          timestamp: new Date().toISOString(),
          action: 'credential_save'
        }
      });
    } catch (logError) {
      console.error('[MPESA-CREDS] Failed to log security event:', logError);
      // Don't fail the request for logging issues
    }

    // Build upsert object based on shortcode type
    const upsertData: any = {
      landlord_id: user.id,
      shortcode_type: shortcode_type || 'paybill',
      callback_url: callback_url || null,
      environment: environment || 'sandbox',
      is_active: is_active !== false, // Default to true
      updated_at: new Date().toISOString()
    };

    if (shortcode_type === 'till_kopokopo') {
      // Kopo Kopo OAuth configuration
      upsertData.till_number = till_number;
      upsertData.till_provider = 'kopokopo';
      upsertData.kopokopo_client_id = kopokopo_client_id;
      upsertData.kopokopo_client_secret_encrypted = encryptedKopokopoClientSecret;
      // Use till_number as business_shortcode for Kopo Kopo (NOT NULL constraint)
      upsertData.business_shortcode = till_number;
      // Clear standard M-Pesa fields
      upsertData.consumer_key_encrypted = null;
      upsertData.consumer_secret_encrypted = null;
      upsertData.passkey_encrypted = null;
    } else {
      // Standard M-Pesa configuration (Paybill or Till Safaricom)
      upsertData.consumer_key_encrypted = encryptedConsumerKey;
      upsertData.consumer_secret_encrypted = encryptedConsumerSecret;
      upsertData.passkey_encrypted = encryptedPasskey;
      upsertData.business_shortcode = shortcode;
      upsertData.till_provider = shortcode_type === 'till_safaricom' ? 'safaricom' : null;
      upsertData.till_number = shortcode_type === 'till_safaricom' ? shortcode : null;
      // Clear Kopo Kopo fields
      upsertData.kopokopo_client_id = null;
      upsertData.kopokopo_client_secret_encrypted = null;
    }

    // Save ONLY encrypted credentials using admin client (bypasses RLS for secure insert)
    // Strategy: Check if a config exists for this landlord + shortcode_type combination
    // If yes → UPDATE it; If no → INSERT new and deactivate others
    const configId = config_id; // Optional field to identify which config to update
    
    let savedConfig;
    let saveError;

    // Check if a config exists for this landlord + shortcode_type combination
    const { data: existingConfig } = await supabaseAdmin
      .from('landlord_mpesa_configs')
      .select('id')
      .eq('landlord_id', user.id)
      .eq('shortcode_type', shortcode_type || 'paybill')
      .maybeSingle(); // Use maybeSingle to avoid error if not found

    if (existingConfig || configId) {
      // UPDATE existing config (either found by shortcode_type or provided configId)
      const updateId = configId || existingConfig.id;
      
      // First deactivate all other configs for this landlord
      await supabaseAdmin
        .from('landlord_mpesa_configs')
        .update({ is_active: false })
        .eq('landlord_id', user.id)
        .neq('id', updateId);
      
      // Then update this config and mark it active
      upsertData.is_active = true;
      
      const result = await supabaseAdmin
        .from('landlord_mpesa_configs')
        .update(upsertData)
        .eq('id', updateId)
        .eq('landlord_id', user.id) // Security: ensure user owns this config
        .select()
        .single();
      
      savedConfig = result.data;
      saveError = result.error;
    } else {
      // INSERT new config - first deactivate all other configs for this landlord
      await supabaseAdmin
        .from('landlord_mpesa_configs')
        .update({ is_active: false })
        .eq('landlord_id', user.id);

      // Then insert new config as active
      upsertData.is_active = true;
      
      const result = await supabaseAdmin
        .from('landlord_mpesa_configs')
        .insert(upsertData)
        .select()
        .single();
      
      savedConfig = result.data;
      saveError = result.error;
    }

    if (saveError) {
      console.error('[MPESA-CREDS] Database save error:', saveError);
      
      // Log failure
      try {
        await supabaseAdmin.rpc('log_security_event', {
          _event_type: 'mpesa_credentials_save_failed',
          _severity: 'high',
          _user_id: user.id,
          _ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          _user_agent: req.headers.get('user-agent'),
          _details: { 
            error: saveError.message,
            code: saveError.code,
            timestamp: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error('Failed to log error event:', err);
      }
      
      throw saveError;
    }

    console.log(`[MPESA-CREDS] Credentials saved successfully for landlord: ${user.id}`);

    // CRITICAL: Update landlord preference to use custom config IMMEDIATELY after save
    // This must happen before logging so the UI can refresh correctly
    const { error: prefError } = await supabaseAdmin
      .from('landlord_payment_preferences')
      .upsert({
        landlord_id: user.id,
        mpesa_config_preference: 'custom',
        preferred_payment_method: 'mpesa' // Default to mpesa if not set
      }, {
        onConflict: 'landlord_id',
        ignoreDuplicates: false
      });

    if (prefError) {
      console.warn('[MPESA-CREDS] Failed to auto-update payment preference:', prefError);
      // Don't fail the whole operation, just log warning
    } else {
      console.log('[MPESA-CREDS] Auto-set mpesa_config_preference to custom');
    }

    // Log successful save (after preference update, in try/catch so it can't break the flow)
    try {
      await supabaseAdmin.rpc('log_security_event', {
        _event_type: 'mpesa_credentials_saved',
        _severity: 'high',
        _user_id: user.id,
        _ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        _user_agent: req.headers.get('user-agent'),
        _details: { 
          environment,
          config_id: savedConfig?.id,
          timestamp: new Date().toISOString(),
          action: 'credential_save_success'
        }
      });
    } catch (err) {
      console.error('Failed to log success event:', err);
      // Don't fail the request for logging issues
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'M-Pesa credentials encrypted and saved securely',
        config_id: savedConfig?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MPESA-CREDS] Critical error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to save M-Pesa credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});