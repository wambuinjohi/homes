import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface CheckAvailabilityRequest {
  invoiceId: string;
}

interface CheckAvailabilityResponse {
  available: boolean;
  configType?: 'till' | 'paybill';
  provider?: string;
  tillNumber?: string;
  paybillNumber?: string;
  source?: 'custom' | 'platform';
  error?: string;
  details?: string;
  // Jenga PAY support
  jengaAvailable?: boolean;
  jengaPaybill?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Check M-Pesa Availability Request');

    // Parse request body
    const { invoiceId } = await req.json() as CheckAvailabilityRequest;

    if (!invoiceId) {
      console.error('❌ Missing invoiceId');
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Missing invoiceId parameter' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📋 Checking availability for invoice: ${invoiceId}`);

    // Create Supabase client with SERVICE ROLE to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Get invoice details
    console.log('🔎 Step 1: Fetching invoice...');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, lease_id, tenant_id, status')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error('❌ Invoice not found:', invoiceError);
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Invoice not found',
          details: invoiceError?.message 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Invoice found: ${invoice.id}, status: ${invoice.status}`);

    // Step 2: Get lease details
    console.log('🔎 Step 2: Fetching lease...');
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('id, unit_id, status')
      .eq('id', invoice.lease_id)
      .single();

    if (leaseError || !lease) {
      console.error('❌ Lease not found:', leaseError);
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Lease not found',
          details: leaseError?.message 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Lease found: ${lease.id}, status: ${lease.status}`);

    // Step 3: Get unit and property
    console.log('🔎 Step 3: Fetching unit and property...');
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, property_id')
      .eq('id', lease.unit_id)
      .single();

    if (unitError || !unit) {
      console.error('❌ Unit not found:', unitError);
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Unit not found',
          details: unitError?.message 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, owner_id')
      .eq('id', unit.property_id)
      .single();

    if (propertyError || !property) {
      console.error('❌ Property not found:', propertyError);
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Property not found',
          details: propertyError?.message 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Property found: ${property.id}, owner: ${property.owner_id}`);

    // Step 4a: Check landlord's custom M-Pesa configuration
    console.log('🔎 Step 4a: Checking landlord custom M-Pesa config...');
    const { data: mpesaConfigs, error: configError } = await supabase
      .from('landlord_mpesa_configs')
      .select('*')
      .eq('landlord_id', property.owner_id)
      .eq('is_active', true)
      .eq('credentials_verified', true)
      .order('created_at', { ascending: false });

    if (configError) {
      console.error('❌ Error fetching M-Pesa config:', configError);
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Error checking M-Pesa configuration',
          details: configError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If custom config exists, use it
    if (mpesaConfigs && mpesaConfigs.length > 0) {
      const config = mpesaConfigs[0];
      console.log(`✅ Custom M-Pesa config found: ${config.id}`);
      console.log(`   Provider: ${config.till_provider || 'Safaricom'}`);
      console.log(`   Till: ${config.till_number || 'N/A'}`);
      console.log(`   Paybill: ${config.paybill_number || 'N/A'}`);

      const response: CheckAvailabilityResponse = {
        available: true,
        provider: config.till_provider || 'safaricom',
        source: 'custom',
      };

      if (config.till_number) {
        response.configType = 'till';
        response.tillNumber = config.till_number;
        console.log(`✅ M-Pesa available via custom Till: ${config.till_number}`);
      } else if (config.paybill_number) {
        response.configType = 'paybill';
        response.paybillNumber = config.paybill_number;
        console.log(`✅ M-Pesa available via custom Paybill: ${config.paybill_number}`);
      }

      return new Response(
        JSON.stringify(response),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 4b: Check if landlord uses platform defaults
    console.log('🔎 Step 4b: Checking landlord payment preferences...');
    const { data: preferences, error: preferencesError } = await supabase
      .from('landlord_payment_preferences')
      .select('mpesa_config_preference')
      .eq('landlord_id', property.owner_id)
      .single();

    if (preferencesError && preferencesError.code !== 'PGRST116') {
      console.error('❌ Error fetching payment preferences:', preferencesError);
    }

    if (preferences?.mpesa_config_preference === 'platform_default') {
      console.log('🔎 Step 4c: Landlord uses platform defaults, fetching platform config...');
      
      const { data: platformConfigData, error: platformError } = await supabase
        .from('billing_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_mpesa_config')
        .single();

      if (platformError) {
        console.error('❌ Error fetching platform M-Pesa config:', platformError);
        return new Response(
          JSON.stringify({ 
            available: false, 
            error: 'Error checking platform M-Pesa configuration',
            details: platformError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const platformConfig = platformConfigData?.setting_value as any;

      if (platformConfig && platformConfig.shortcode) {
        console.log(`✅ Platform M-Pesa config found: ${platformConfig.shortcode}`);
        console.log(`   Type: ${platformConfig.shortcode_type}`);
        console.log(`   Environment: ${platformConfig.environment}`);

        const response: CheckAvailabilityResponse = {
          available: true,
          provider: 'safaricom',
          source: 'platform',
          configType: platformConfig.shortcode_type === 'till' ? 'till' : 'paybill',
        };

        if (platformConfig.shortcode_type === 'till') {
          response.tillNumber = platformConfig.shortcode;
          console.log(`✅ M-Pesa available via platform Till: ${platformConfig.shortcode}`);
        } else {
          response.paybillNumber = platformConfig.shortcode;
          console.log(`✅ M-Pesa available via platform Paybill: ${platformConfig.shortcode}`);
        }

        return new Response(
          JSON.stringify(response),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Step 4d: Check for Jenga PAY configuration before returning no config
    console.log('🔎 Step 4d: Checking Jenga PAY config...');
    const { data: jengaConfig, error: jengaError } = await supabase
      .from('landlord_jenga_configs')
      .select('*')
      .eq('landlord_id', property.owner_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!jengaError && jengaConfig) {
      console.log(`✅ Jenga PAY config found for landlord`);
      return new Response(
        JSON.stringify({ 
          available: true, 
          provider: 'jenga',
          configType: 'paybill',
          paybillNumber: jengaConfig.paybill_number || '247247',
          source: 'custom',
          jengaAvailable: true,
          jengaPaybill: jengaConfig.paybill_number || '247247'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 4e: No M-Pesa or Jenga configuration found
    console.log('⚠️ No payment configuration found for landlord');
    return new Response(
      JSON.stringify({ 
        available: false, 
        error: 'M-Pesa not configured',
        details: 'The landlord has not set up M-Pesa or Jenga PAY payments yet' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        available: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
