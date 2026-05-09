import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestKopokopoRequest {
  config_id?: string;
  landlord_id?: string;
  client_id: string;
  client_secret?: string;
  environment: 'sandbox' | 'production';
}

// Decrypt stored credentials
async function decryptCredential(encrypted: string): Promise<string> {
  const encryptionKey = Deno.env.get('MPESA_ENCRYPTION_KEY');
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  // Decode the base64 encryption key
  const keyData = Uint8Array.from(atob(encryptionKey), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decode from base64 - format is: IV (12 bytes) + ciphertext
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);  // First 12 bytes = IV
  const ciphertext = combined.slice(12);  // Rest = encrypted data

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config_id, landlord_id, client_id, client_secret, environment }: TestKopokopoRequest = await req.json();

    console.log('Testing Kopo Kopo credentials:', { config_id: config_id || 'new', client_id, environment });

    let clientSecret = client_secret;

    // If testing existing config, retrieve stored encrypted secret
    if (config_id && landlord_id && !client_secret) {
      console.log(`🔍 Retrieving stored credentials for config: ${config_id}`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      
      const { data: configData, error: configError } = await supabaseClient
        .from('landlord_mpesa_configs')
        .select('kopokopo_client_secret_encrypted')
        .eq('id', config_id)
        .eq('landlord_id', landlord_id)
        .single();
      
      if (configError || !configData?.kopokopo_client_secret_encrypted) {
        console.error('Failed to retrieve stored credentials:', configError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Could not retrieve stored credentials. Please re-enter your credentials.'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      try {
        clientSecret = await decryptCredential(configData.kopokopo_client_secret_encrypted);
        console.log('✅ Retrieved and decrypted stored client secret');
      } catch (decryptError) {
        console.error('Failed to decrypt credentials:', decryptError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Could not decrypt stored credentials. Please re-enter your credentials.'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Validate required fields
    if (!client_id || !clientSecret || !environment) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: client_id, client_secret, or environment' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine the correct auth URL based on environment
    const authUrl = environment === 'production'
      ? 'https://api.kopokopo.com/oauth/token'
      : 'https://sandbox.kopokopo.com/oauth/token';

    // Test the OAuth connection
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      console.error('Kopo Kopo OAuth failed:', authData);
      
      // Parse error message
      let errorMessage = 'Invalid credentials. Please check your Client ID and Client Secret.';
      
      if (authData.error === 'invalid_client') {
        errorMessage = 'Invalid Client ID or Client Secret. Please verify your OAuth credentials.';
      } else if (authData.error === 'unauthorized') {
        errorMessage = 'Unauthorized. Your credentials may not have the necessary permissions.';
      } else if (authData.error_description) {
        errorMessage = authData.error_description;
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          details: authData.error || 'Authentication failed'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Successfully authenticated
    console.log('Kopo Kopo credentials validated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Credentials validated successfully',
        token_type: authData.token_type,
        expires_in: authData.expires_in
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error testing Kopo Kopo credentials:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to test credentials. Please try again.',
        details: 'Network or server error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
