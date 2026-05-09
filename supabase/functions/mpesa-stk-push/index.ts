import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 🔖 VERSION: 2025-11-12-v2.4 - Normalized provider/till display + invoice_id reconciliation
  console.log('🚀 mpesa-stk-push VERSION: 2025-11-12-v2.4 (normalized response + invoice_id)');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Early environment sanity check
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    console.log('🔍 ENV CHECK:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceRoleKey: !!supabaseServiceRoleKey,
      url: supabaseUrl
    });

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ CRITICAL: Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          errorId: 'AUTH_SUPABASE_ENV_MISSING',
          hint: 'Supabase URL or ANON KEY is not configured. Contact support.'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get authorization header - check both lowercase and uppercase variants
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ AUTH FAIL: No valid authorization header', {
        hasAuthHeader: !!authHeader,
        headerPrefix: authHeader?.substring(0, 10),
        headers: Array.from(req.headers.keys()),
        method: req.method,
        url: req.url
      });
      return new Response(
        JSON.stringify({ 
          error: 'Authorization required',
          errorId: 'AUTH_MISSING_TOKEN',
          hint: 'No valid Bearer token found. Please ensure you are logged in.'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extract token explicitly
    const token = authHeader.replace('Bearer ', '').trim();
  console.log('✅ Authorization token extracted:', token.substring(0, 20) + '...');

  // Create user-scoped client and pass token explicitly to getUser
  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey);
  console.log('🔐 Validating user token with Supabase Auth...');
  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ AUTH FAIL: Token validation failed', {
        authError: authError?.message,
        authErrorName: authError?.name,
        authErrorStatus: authError?.status,
        hasToken: !!token,
        tokenPrefix: token.substring(0, 20) + '...',
        timestamp: new Date().toISOString()
      });

      // Attempt to decode JWT for debugging (fallback)
      let decodedUserId = null;
      try {
        const payload = token.split('.')[1];
        if (payload) {
          const decoded = JSON.parse(atob(payload));
          decodedUserId = decoded.sub;
          console.log('🔓 JWT decoded (fallback):', { sub: decoded.sub, exp: decoded.exp });
        }
      } catch (decodeError) {
        console.error('Failed to decode JWT:', decodeError);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Invalid authentication',
          errorId: 'AUTH_INVALID_JWT',
          hint: authError?.message || 'User session is not valid. Please log in again.',
          debug: {
            hasToken: !!token,
            decodedUserId
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ User authenticated successfully:', user.id);

    // Initialize admin client after auth passes for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Also create a user-scoped client for operations that should respect RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

  const requestBody = await req.json();
  console.log('📦 REQUEST BODY:', JSON.stringify(requestBody, null, 2));
  
  // Input validation with enhanced security
  const { phone, amount, accountReference, transactionDesc, invoiceId, paymentType, landlordId, dryRun } = requestBody;
  
  console.log('📋 Parsed request parameters:', {
    hasPhone: !!phone,
    amount,
    paymentType,
    invoiceId,
    landlordId,
    dryRun
  });

  // Rate limiting check (basic implementation)
  const rateLimitKey = `mpesa_stk_${user.id}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 5;

  // Simple rate limiting using headers (in production, use Redis or similar)
  const rateLimitData = req.headers.get('x-rate-limit-data');
  let requestCount = 1;
  let windowStart = now;
  
  if (rateLimitData) {
    try {
      const parsed = JSON.parse(rateLimitData);
      if (now - parsed.windowStart < windowMs) {
        requestCount = parsed.count + 1;
        windowStart = parsed.windowStart;
      }
    } catch (e) {
      // Invalid data, use defaults
    }
  }

  if (requestCount > maxRequests) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Log request with security details
  console.log('=== MPESA STK PUSH REQUEST START ===');
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('x-real-ip')?.trim() || 
                   'unknown';
  
  console.log('Request from IP:', clientIP);
  console.log('Request payload (sanitized):', {
    phone: phone ? `***${phone.toString().slice(-4)}` : 'missing',
    amount,
    accountReference,
    transactionDesc,
    invoiceId,
    paymentType,
    landlordId,
    dryRun,
    timestamp: new Date().toISOString()
  });

  // Enhanced input validation
  if (!phone || !amount) {
    console.error('Missing required fields:', { phone: !!phone, amount: !!amount });
    return new Response(
      JSON.stringify({ error: 'Missing required fields: phone, amount' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Validate amount is positive number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount) || numAmount <= 0 || numAmount > 1000000) {
    console.error('Invalid amount:', amount);
    return new Response(
      JSON.stringify({ error: 'Invalid amount. Must be a positive number less than 1,000,000' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Validate phone number format
  const phoneStr = phone.toString().replace(/\D/g, '');
  if (phoneStr.length < 9 || phoneStr.length > 15) {
    console.error('Invalid phone number:', phone);
    return new Response(
      JSON.stringify({ error: 'Invalid phone number format' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

    // Move dry run check after we get M-Pesa config
    let shouldProcessDryRun = dryRun;

    // Authorization checks based on payment type
    console.log('🔐 AUTHORIZATION CHECK START:', {
      paymentType,
      invoiceId,
      userId: user.id,
      userEmail: user.email,
      providedLandlordId: landlordId
    });
    let authorized = false;
    let landlordConfigId = landlordId;

    if (paymentType === 'service-charge') {
      // Service charge: Only landlords can pay their own service charges or admins
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some(r => r.role === 'Admin');

      if (isAdmin) {
        authorized = true;
        console.log('✅ Authorization: Admin user');
      } else if (invoiceId) {
        // Check if user is the landlord for this service charge invoice
        const { data: serviceInvoice } = await supabase
          .from('service_charge_invoices')
          .select('landlord_id')
          .eq('id', invoiceId)
          .eq('landlord_id', user.id)
          .single();

        if (serviceInvoice) {
          authorized = true;
          landlordConfigId = serviceInvoice.landlord_id;
          console.log('✅ Authorization: Service charge invoice owner');
        }
      }
    } else if (paymentType === 'subscription') {
      // Subscription payment: Any authenticated user can pay for their own subscription
      authorized = true;
      landlordConfigId = user.id;
      console.log('✅ Authorization: Subscription payment (self)');
    } else if (paymentType === 'sms_bundle') {
      // SMS bundle purchase: Only landlords and admins can purchase SMS credits
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some(r => r.role === 'Admin');
      const isLandlord = userRoles?.some(r => r.role === 'Landlord');

      if (isAdmin || isLandlord) {
        authorized = true;
        landlordConfigId = user.id;
        console.log('✅ Authorization: SMS bundle purchase (Admin/Landlord)');
      }
    } else if (paymentType === 'test') {
      // Test configuration: Allow landlords to test their own M-Pesa setup
      // Only the landlord who owns the configuration can test it
      if (landlordId && landlordId === user.id) {
        authorized = true;
        landlordConfigId = user.id;
        console.log('✅ Test payment authorized for landlord:', user.id);
      } else {
        console.error('❌ Test payment denied: landlordId must match authenticated user');
      }
    } else {
      // Rent payment: Check if user is tenant for this invoice OR property owner/manager OR admin
      console.log('🔍 Checking rent payment authorization for invoiceId:', invoiceId);
      if (invoiceId) {
        const { data: invoiceAuth, error: invoiceError } = await supabaseAdmin
          .from('invoices')
          .select(`
            tenant_id,
            leases!invoices_lease_id_fkey!inner(
              tenant_id,
              unit_id,
              units!leases_unit_id_fkey!inner(
                property_id,
                properties!units_property_id_fkey!inner(owner_id, manager_id)
              )
            ),
            tenants!invoices_tenant_id_fkey!inner(user_id)
          `)
          .eq('id', invoiceId)
          .single();
        
        console.log('📋 Invoice authorization data:', {
          found: !!invoiceAuth,
          error: invoiceError?.message,
          tenantUserId: invoiceAuth?.tenants?.user_id,
          ownerId: invoiceAuth?.leases?.units?.properties?.owner_id,
          currentUserId: user.id
        });

        console.log('📋 Invoice authorization query result:', {
          found: !!invoiceAuth,
          error: invoiceError?.message,
          invoiceId
        });

        if (invoiceError) {
          console.error('❌ Failed to fetch invoice for authorization:', invoiceError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to verify payment authorization',
              errorId: 'AUTH_QUERY_FAILED',
              details: invoiceError.message
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        if (!invoiceAuth) {
          console.error('❌ Invoice not found:', invoiceId);
          return new Response(
            JSON.stringify({ 
              error: 'Invoice not found',
              errorId: 'AUTH_INVOICE_NOT_FOUND',
              invoiceId
            }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        if (invoiceAuth) {
          const isTenant = invoiceAuth.tenants.user_id === user.id;
          const isOwner = invoiceAuth.leases.units.properties.owner_id === user.id;
          const isManager = invoiceAuth.leases.units.properties.manager_id === user.id;
          
          console.log('🔍 Authorization role check:', {
            isTenant,
            isOwner,
            isManager,
            tenantUserId: invoiceAuth.tenants.user_id,
            ownerId: invoiceAuth.leases.units.properties.owner_id
          });

          const { data: userRoles } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          const isAdmin = userRoles?.some(r => r.role === 'Admin');
          
          console.log('🔍 Admin check:', { isAdmin, roles: userRoles?.map(r => r.role) });

          if (isTenant || isOwner || isManager || isAdmin) {
            authorized = true;
            landlordConfigId = invoiceAuth.leases.units.properties.owner_id;
            console.log('✅ Authorization SUCCESS:', { 
              reason: isTenant ? 'tenant' : isOwner ? 'owner' : isManager ? 'manager' : 'admin',
              landlordConfigId
            });
          } else {
            console.log('❌ Authorization FAILED: User is not tenant, owner, manager, or admin');
          }
        }
      }
    }

    if (!authorized) {
      console.error('❌ Authorization failed:', {
        userId: user.id,
        paymentType,
        invoiceId,
        landlordId,
        reason: 'User not authorized for this payment'
      });
      return new Response(
        JSON.stringify({ 
          error: 'You are not authorized to initiate this payment',
          errorId: 'AUTH_NOT_AUTHORIZED',
          paymentType,
          userId: user.id
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Authorization successful:', {
      userId: user.id,
      paymentType,
      landlordConfigId
    });

    // Try to get landlord-specific M-Pesa config first    
    // If no landlordId provided, try to get it from invoice
    if (!landlordConfigId && invoiceId) {
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
        .eq('id', invoiceId)
        .single();

      if (invoiceData?.leases?.units?.properties?.owner_id) {
        landlordConfigId = invoiceData.leases.units.properties.owner_id;
      }
    }

    // IMPROVED: Check for active custom config first, then preferences
    let mpesaConfig = null;
    let mpesaConfigPreference = 'platform_default';

    console.log('🔍 FETCHING M-PESA CONFIG for landlordId:', landlordConfigId);
    
    if (landlordConfigId) {
      // Step 1: Check for active custom config first (robust approach)
      const { data: config, error: configError } = await supabaseAdmin
        .from('landlord_mpesa_configs')
        .select('*')
        .eq('landlord_id', landlordConfigId)
        .eq('is_active', true)
        .maybeSingle();

      console.log('📊 M-PESA CONFIG QUERY RESULT:', {
        found: !!config,
        error: configError?.message,
        configId: config?.id,
        shortcode: config?.business_shortcode,
        verified: config?.credentials_verified
      });

      mpesaConfig = config;

      if (mpesaConfig) {
        console.log('✅ LANDLORD M-PESA CONFIG FOUND:', {
          landlordId: landlordConfigId,
          configId: mpesaConfig.id,
          shortcode: mpesaConfig.business_shortcode,
          shortcode_type: mpesaConfig.shortcode_type,
          environment: mpesaConfig.environment,
          credentials_verified: mpesaConfig.credentials_verified,
          till_provider: mpesaConfig.till_provider,
          has_consumer_key: !!mpesaConfig.consumer_key_encrypted,
          has_consumer_secret: !!mpesaConfig.consumer_secret_encrypted,
          has_passkey: !!mpesaConfig.passkey_encrypted,
          has_kopokopo_client_id: !!mpesaConfig.kopokopo_client_id,
          has_kopokopo_client_secret: !!mpesaConfig.kopokopo_client_secret_encrypted
        });

        // Step 2: Check preference setting
        const { data: paymentPrefs } = await supabaseAdmin
          .from('landlord_payment_preferences')
          .select('mpesa_config_preference')
          .eq('landlord_id', landlordConfigId)
          .maybeSingle();

        mpesaConfigPreference = paymentPrefs?.mpesa_config_preference || 'platform_default';

        // Step 3: Self-heal preference if needed
        if (mpesaConfigPreference !== 'custom') {
          console.log('🔄 Self-healing: Active config exists but preference is not "custom". Updating...');
          await supabaseAdmin
            .from('landlord_payment_preferences')
            .upsert({
              landlord_id: landlordConfigId,
              mpesa_config_preference: 'custom',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'landlord_id'
            });
          console.log('✅ Preference self-healed to "custom" for landlord:', landlordConfigId);
        }
      } else {
        // No custom config exists, check preference (might be platform_default or unset)
        const { data: paymentPrefs } = await supabaseAdmin
          .from('landlord_payment_preferences')
          .select('mpesa_config_preference')
          .eq('landlord_id', landlordConfigId)
          .maybeSingle();

        mpesaConfigPreference = paymentPrefs?.mpesa_config_preference || 'platform_default';
        console.log('💳 No custom config found. Using preference:', {
          landlordId: landlordConfigId,
          preference: mpesaConfigPreference
        });
        console.log('✅ Using platform default M-Pesa config');
      }
    }

    // Helper function to decrypt credentials
    async function decryptCredential(encrypted: string, keyBase64: string): Promise<string> {
      console.log('🔓 Attempting to decrypt credential...');
      try {
        // Decode the base64 encryption key (SAME AS ENCRYPTION)
        const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
        
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,  // Use decoded keyData directly, no padding
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        // Decode from base64
        const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          ciphertext
        );

        const decryptedValue = new TextDecoder().decode(decrypted);
        console.log('✅ Decryption successful');
        return decryptedValue;
      } catch (e) {
        console.error('❌ Decryption error:', e);
        throw new Error('Failed to decrypt credential');
      }
    }

    // M-Pesa credentials - SECURITY: Use environment variables, decrypt landlord config
    let consumerKey: string | undefined, consumerSecret: string | undefined, shortcode: string | undefined, passkey: string | undefined;
    let kopokopoClientId: string | undefined, kopokopoClientSecret: string | undefined, tillNumber: string | undefined;
    let paymentProvider = 'mpesa'; // 'mpesa' or 'kopokopo'
    
    console.log('🔐 Starting credential resolution process...');
    
    // Normalize environment to handle case variations (PRODUCTION, production, prod, etc.)
    const rawEnv = mpesaConfig?.environment || Deno.env.get('MPESA_ENVIRONMENT') || 'sandbox';
    const environment = String(rawEnv).toLowerCase().includes('prod') ? 'production' : 'sandbox';
    
    console.log('🌍 Environment normalized:', { rawEnv, environment });
    
    if (mpesaConfig) {
      // Check payment provider type
      const shortcodeType = mpesaConfig.shortcode_type;
      const tillProvider = mpesaConfig.till_provider;
      
      console.log('📋 Payment config type:', { shortcodeType, tillProvider });
      
      // Decrypt credentials (encrypted-only storage enforced)
      const encryptionKey = Deno.env.get('MPESA_ENCRYPTION_KEY');
      
      if (!encryptionKey) {
        console.error('❌ MPESA_ENCRYPTION_KEY not configured in environment');
        return new Response(
          JSON.stringify({
            error: 'Server encryption configuration missing',
            errorId: 'MPESA_ENCRYPTION_CONFIG_MISSING'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        if (shortcodeType === 'till_kopokopo' && tillProvider === 'kopokopo') {
          // Kopo Kopo OAuth payment processing
          paymentProvider = 'kopokopo';
          tillNumber = mpesaConfig.till_number;
          kopokopoClientId = mpesaConfig.kopokopo_client_id;
          kopokopoClientSecret = await decryptCredential(mpesaConfig.kopokopo_client_secret_encrypted, encryptionKey);
          
          console.log('✅ Successfully retrieved Kopo Kopo credentials');
          console.log('📱 Kopo Kopo Till:', tillNumber);
          console.log('🔑 Kopo Kopo Client ID:', kopokopoClientId);
        } else {
          // Standard M-Pesa payment processing (Paybill or Till Safaricom)
          paymentProvider = 'mpesa';
          consumerKey = await decryptCredential(mpesaConfig.consumer_key_encrypted, encryptionKey);
          consumerSecret = await decryptCredential(mpesaConfig.consumer_secret_encrypted, encryptionKey);
          passkey = await decryptCredential(mpesaConfig.passkey_encrypted, encryptionKey);
          shortcode = mpesaConfig.business_shortcode; // Not encrypted
          
          console.log('✅ Successfully decrypted landlord M-Pesa credentials');
          console.log('📱 Shortcode type:', shortcodeType);
        }
      } catch (decryptError) {
        console.error('❌ Failed to decrypt landlord credentials:', decryptError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to decrypt payment credentials',
            errorId: 'PAYMENT_DECRYPTION_FAILED',
            hint: 'Landlord may need to re-configure payment settings'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Use global fallback credentials from secrets (M-Pesa only)
      paymentProvider = 'mpesa';
      consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
      consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
      shortcode = Deno.env.get('MPESA_SHORTCODE');
      passkey = Deno.env.get('MPESA_PASSKEY');
      console.log('Using global fallback M-Pesa credentials');
    }

    console.log('Payment Provider Check:', {
      paymentProvider,
      hasConsumerKey: !!consumerKey,
      hasConsumerSecret: !!consumerSecret,
      hasPasskey: !!passkey,
      hasKopokopoClientId: !!kopokopoClientId,
      hasKopokopoClientSecret: !!kopokopoClientSecret,
      tillNumber,
      environment,
      usingLandlordConfig: !!mpesaConfig
    });

    // Handle dry run early - return config without initiating payment (works for both providers)
    if (shouldProcessDryRun) {
      console.log('🔍 Dry run mode - returning config only');
      const isKopoKopo = paymentProvider === 'kopokopo';
      const isTill = mpesaConfig?.shortcode_type === 'till_safaricom' || 
                     mpesaConfig?.shortcode_type === 'till' || 
                     isKopoKopo;
      const transactionType = isTill ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
      
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          data: {
            Provider: isKopoKopo ? 'kopokopo' : 'mpesa',
            TillNumber: isKopoKopo ? tillNumber : null,
            BusinessShortCode: isKopoKopo ? tillNumber : shortcode,
            Environment: environment,
            UsingLandlordConfig: !!mpesaConfig,
            TransactionType: transactionType,
            DisplayName: mpesaConfig?.display_name || 'Platform M-Pesa'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // KOPO KOPO PAYMENT PROCESSING
    if (paymentProvider === 'kopokopo') {
      console.log('🔄 Processing payment via Kopo Kopo OAuth...');
      
      if (!kopokopoClientId || !kopokopoClientSecret || !tillNumber) {
        console.error('Missing Kopo Kopo OAuth credentials:', {
          missingClientId: !kopokopoClientId,
          missingClientSecret: !kopokopoClientSecret,
          missingTillNumber: !tillNumber
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Kopo Kopo payment gateway not configured properly',
            errorId: 'KOPOKOPO_CONFIG_MISSING',
            landlordId: landlordConfigId,
            missing: {
              clientId: !kopokopoClientId,
              clientSecret: !kopokopoClientSecret,
              tillNumber: !tillNumber
            }
          }),
          { 
            status: 503, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Format phone number for Kopo Kopo
      let phoneNumber = phone.toString().replace(/\D/g, '');
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '+254' + phoneNumber.slice(1);
      } else if (!phoneNumber.startsWith('254')) {
        phoneNumber = '+254' + phoneNumber;
      } else if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber;
      }

      try {
        console.log('📱 Step 1: Getting Kopo Kopo OAuth token...');
        
        // Get OAuth access token
        const tokenUrl = environment === 'production'
          ? 'https://api.kopokopo.com/oauth/token'
          : 'https://sandbox.kopokopo.com/oauth/token';

        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'PropertyManagement/1.0'
          },
          body: new URLSearchParams({
            client_id: kopokopoClientId,
            client_secret: kopokopoClientSecret,
            grant_type: 'client_credentials'
          })
        });

        if (!tokenResponse.ok) {
          let tokenError;
          try {
            tokenError = await tokenResponse.json();
          } catch (e) {
            tokenError = { error: 'Failed to parse OAuth error response', status: tokenResponse.status };
          }
          console.error('❌ Kopo Kopo OAuth error:', tokenError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to authenticate with Kopo Kopo',
              errorId: 'KOPOKOPO_AUTH_FAILED',
              details: tokenError,
              userMessage: 'Payment gateway authentication failed. Please contact your landlord to verify M-Pesa configuration.'
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let tokenData;
        try {
          tokenData = await tokenResponse.json();
        } catch (e) {
          console.error('❌ Failed to parse OAuth token response:', e);
          return new Response(
            JSON.stringify({ 
              error: 'Invalid OAuth response from Kopo Kopo',
              errorId: 'KOPOKOPO_AUTH_PARSE_FAILED',
              userMessage: 'Payment gateway returned invalid response. Please try again.'
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const accessToken = tokenData.access_token;
        
        console.log('✅ Kopo Kopo access token obtained');
        console.log('📱 Step 2: Initiating STK Push...');

        // Construct callback URL
        const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kopokopo-callback`;

        // Standardize reference for consistent reconciliation
        const standardReference = accountReference || `PAY${Date.now()}`;
        console.log('📋 Standardized reference:', standardReference);

        // Kopo Kopo STK Push payload (following official API format)
        // Reference: https://developers.kopokopo.com/guides/receive-money/mpesa-stk.html
        const kopokopoPayload = {
          payment_channel: 'M-PESA STK Push',
          till_number: tillNumber, // ✅ Raw till number (no prefix)
          subscriber: {
            first_name: 'Customer',
            last_name: 'Payment',
            phone_number: phoneNumber,
            email: 'customer@property.com'
          },
          amount: {
            currency: 'KES',
            value: amount // Amount in KES (not cents)
          },
          metadata: {
            reference: standardReference,
            notes: (transactionDesc || 'Payment request').substring(0, 100)
          },
          _links: {
            callback_url: callbackUrl
          }
        };

        console.log('📦 Kopo Kopo STK Push payload (snake_case):', JSON.stringify(kopokopoPayload, null, 2));
        console.log('📊 Till number used:', tillNumber);
        console.log('📊 Metadata details:', {
          fieldCount: Object.keys(kopokopoPayload.metadata).length,
          stringifiedLength: JSON.stringify(kopokopoPayload.metadata).length,
          fields: Object.keys(kopokopoPayload.metadata)
        });

        // Call Kopo Kopo API
        const kopokopoBaseUrl = environment === 'production'
          ? 'https://api.kopokopo.com'
          : 'https://sandbox.kopokopo.com';

        const kopokopoResponse = await fetch(
          `${kopokopoBaseUrl}/api/v1/incoming_payments`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'PropertyManagement/1.0'
            },
            body: JSON.stringify(kopokopoPayload)
          }
        );

        // Handle 201/202 Accepted (STK Push successfully queued) - MAIN BRANCH
        if (kopokopoResponse.status === 201 || kopokopoResponse.status === 202) {
          console.log(`✅ [SNAKE_${kopokopoResponse.status}] STK Push accepted by Kopo Kopo (${kopokopoResponse.status}) - Payment queued`);
          
          // Generate unique synthetic checkout ID
          const checkoutRequestId = `kk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          
          // Insert pending transaction record
          const { data: txnData, error: txnError } = await supabaseAdmin
            .from('mpesa_transactions')
            .insert({
              merchant_request_id: checkoutRequestId,
              checkout_request_id: checkoutRequestId,
              phone_number: phoneNumber,
              amount: amount,
              status: 'pending',
              result_code: null,
              result_desc: 'Awaiting user input',
              invoice_id: invoiceId || null,
              payment_type: paymentType || 'rent',
              initiated_by: user.id,
              authorized_by: user.id,
              provider: 'kopokopo',
              metadata: {
                reference: standardReference,
                description: transactionDesc,
                landlord_id: landlordConfigId,
                provider: 'kopokopo',
                till: tillNumber,
                incoming_payment_url: kopokopoResponse.headers.get('Location'),
                branch: `snake_${kopokopoResponse.status}`
              }
            })
            .select()
            .single();

          if (txnError) {
            console.error('❌ Failed to store pending transaction:', txnError);
          } else {
            console.log('✅ Pending transaction stored:', txnData?.id);
          }

          return new Response(
            JSON.stringify({
              success: true,
              provider: 'kopokopo',
              tillNumber: tillNumber,
              CheckoutRequestID: checkoutRequestId,
              MerchantRequestID: checkoutRequestId,
              message: 'STK push sent successfully. Please check your phone and enter your M-Pesa PIN.',
              data: {
                provider: 'kopokopo',
                tillNumber: tillNumber,
                CheckoutRequestID: checkoutRequestId,
                ResponseDescription: 'Kopo Kopo STK push queued',
                status: 'pending',
                branch: `snake_${kopokopoResponse.status}`
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // For other status codes, try to parse JSON response
        let kopokopoData;
        try {
          kopokopoData = await kopokopoResponse.json();
        } catch (parseError) {
          console.error('❌ Failed to parse Kopo Kopo response:', parseError, 'Status:', kopokopoResponse.status);
          
          // If we get here with non-202, it's likely a gateway error
          return new Response(
            JSON.stringify({ 
              error: 'Invalid response from payment gateway',
              errorId: 'KOPOKOPO_RESPONSE_PARSE_FAILED',
              status: kopokopoResponse.status,
              userMessage: 'Payment gateway returned invalid response. Please try again or contact support.'
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('📦 [SNAKE_JSON] Kopo Kopo response:', JSON.stringify(kopokopoData, null, 2));

        if (!kopokopoResponse.ok) {
          console.error('❌ Kopo Kopo STK Push failed:', kopokopoData);
          
          // Handle specific error codes
          let userMessage = 'Failed to initiate M-Pesa payment';
          let errorId = 'KOPOKOPO_REQUEST_FAILED';
          let shouldRetry = true;
          
          if (kopokopoResponse.status === 429 || kopokopoData.error_code === 429) {
            errorId = 'KOPOKOPO_RATE_LIMIT';
            if (kopokopoData.error_message?.includes('pending request')) {
              userMessage = 'There is already a pending M-Pesa request for this phone number. Please complete or cancel the existing request first.';
              shouldRetry = false;
            } else {
              userMessage = 'Too many payment requests. Please wait a moment and try again.';
              shouldRetry = true;
            }
          } else if (kopokopoData.error_message?.includes('Till number is invalid') || kopokopoData.error_message?.includes('till_number')) {
            console.log('⚠️ Till number validation failed, trying camelCase payload (PHP-style)...');
            
            // Retry with camelCase payload matching the working PHP example
            const camelCasePayload = {
              paymentChannel: 'M-PESA STK Push',
              tillNumber: tillNumber,
              firstName: 'Customer',
              lastName: 'Payment',
              phoneNumber: phoneNumber,
              amount: Number(amount),
              currency: 'KES',
              callbackUrl: callbackUrl,
              metadata: {
                customerId: `CUST${Date.now()}`,
                reference: standardReference,
                notes: (transactionDesc || 'Payment request').substring(0, 100)
              }
            };
            
            console.log('🔄 Retrying with camelCase payload:', JSON.stringify(camelCasePayload, null, 2));
            
            const camelRetryResponse = await fetch(
              `${kopokopoBaseUrl}/api/v1/incoming_payments`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'User-Agent': 'PropertyManagement/1.0'
                },
                body: JSON.stringify(camelCasePayload)
              }
            );
            
            // Handle 201/202 Accepted in retry - CAMELCASE BRANCH
            if (camelRetryResponse.status === 201 || camelRetryResponse.status === 202) {
              console.log(`✅ [CAMEL_${camelRetryResponse.status}] CamelCase retry: STK Push accepted (${camelRetryResponse.status}) - Payment queued`);
              
              const checkoutRequestId = `kk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              
              await supabaseAdmin
                .from('mpesa_transactions')
                .insert({
                  merchant_request_id: checkoutRequestId,
                  checkout_request_id: checkoutRequestId,
                  phone_number: phoneNumber,
                  amount: amount,
                  status: 'pending',
                  result_code: null,
                  result_desc: 'Awaiting user input',
                  invoice_id: invoiceId || null,
                  payment_type: paymentType || 'rent',
                  initiated_by: user.id,
                  authorized_by: user.id,
                  provider: 'kopokopo',
                  metadata: {
                    reference: standardReference,
                    description: transactionDesc,
                    landlord_id: landlordConfigId,
                    provider: 'kopokopo',
                    till: tillNumber,
                    incoming_payment_url: camelRetryResponse.headers.get('Location'),
                    branch: `camel_${camelRetryResponse.status}`
                  }
                });

              return new Response(
                JSON.stringify({
                  success: true,
                  provider: 'kopokopo',
                  tillNumber: tillNumber,
                  CheckoutRequestID: checkoutRequestId,
                  MerchantRequestID: checkoutRequestId,
                  message: 'STK push sent successfully. Please check your phone and enter your M-Pesa PIN.',
                  data: {
                    provider: 'kopokopo',
                    tillNumber: tillNumber,
                    CheckoutRequestID: checkoutRequestId,
                    ResponseDescription: 'Kopo Kopo STK push queued (camelCase retry)',
                    status: 'pending',
                    branch: `camel_${camelRetryResponse.status}`
                  }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            let camelRetryData;
            try {
              camelRetryData = await camelRetryResponse.json();
            } catch (parseError) {
              console.error('❌ Failed to parse camelCase retry response:', parseError);
              return new Response(
                JSON.stringify({ 
                  error: 'Invalid retry response from payment gateway',
                  errorId: 'KOPOKOPO_RETRY_PARSE_FAILED',
                  userMessage: 'Payment gateway returned invalid response. Please try again.'
                }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            console.log('📦 [CAMEL_JSON] CamelCase retry response:', JSON.stringify(camelRetryData, null, 2));
            
            if (camelRetryResponse.ok) {
              console.log('✅ [CAMEL_SUCCESS] Kopo Kopo STK Push successful (camelCase format)');
              
              // Store transaction
              const { error: txnError } = await supabaseAdmin
                .from('mpesa_transactions')
                .insert({
                  merchant_request_id: camelRetryData.data?.id || `KK-${Date.now()}`,
                  checkout_request_id: camelRetryData.data?.resource_id || `checkout-${Date.now()}`,
                  phone_number: phoneNumber,
                  amount: amount,
                  account_reference: accountReference,
                  transaction_desc: transactionDesc,
                  status: 'pending',
                  invoice_id: invoiceId || null,
                  payment_type: paymentType || 'rent',
                  initiated_by: user.id,
                  authorized_by: user.id,
                  provider: 'kopokopo',
                  metadata: {
                    reference: standardReference,
                    description: transactionDesc,
                    landlord_id: landlordConfigId,
                    provider: 'kopokopo',
                    till: tillNumber,
                    branch: 'camel_json_ok'
                  }
                });

              if (txnError) {
                console.error('Failed to store transaction:', txnError);
              }

              return new Response(
                JSON.stringify({ 
                  success: true,
                  provider: 'kopokopo',
                  tillNumber: tillNumber,
                  CheckoutRequestID: camelRetryData.data?.resource_id || `checkout-${Date.now()}`,
                  MerchantRequestID: camelRetryData.data?.id || `KK-${Date.now()}`,
                  message: 'STK push sent successfully. Please check your phone and enter your M-Pesa PIN.',
                  data: {
                    provider: 'kopokopo',
                    tillNumber: tillNumber,
                    CheckoutRequestID: camelRetryData.data?.resource_id || `checkout-${Date.now()}`,
                    branch: 'camel_json_ok',
                    ...camelRetryData
                  }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              console.error('❌ CamelCase retry also failed:', camelRetryData);
              errorId = 'KOPOKOPO_TILL_INVALID';
              userMessage = 'Till number validation failed. Please contact your landlord to verify the M-Pesa Till configuration.';
              return new Response(
                JSON.stringify({ 
                  error: userMessage,
                  errorId,
                  userMessage,
                  details: camelRetryData,
                  shouldRetry: false
                }),
                { status: camelRetryResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else if (kopokopoData.error_message?.includes('metadata')) {
            console.log('⚠️ Metadata validation failed, retrying without metadata...');
            
            // Retry without metadata
            const simplePayload = {
              payment_channel: 'M-PESA STK Push',
              till_number: tillNumber, // ✅ Raw till number without "K" prefix
              subscriber: {
                first_name: 'Customer',
                last_name: 'Payment',
                phone_number: phoneNumber,
                email: 'customer@property.com'
              },
              amount: {
                currency: 'KES',
                value: amount
              },
              _links: {
                callback_url: callbackUrl
              }
            };
            
            console.log('🔄 Retrying without metadata:', JSON.stringify(simplePayload, null, 2));
            
            const retryResponse = await fetch(
              `${kopokopoBaseUrl}/api/v1/incoming_payments`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'User-Agent': 'PropertyManagement/1.0'
                },
                body: JSON.stringify(simplePayload)
              }
            );
            
            const retryData = await retryResponse.json();
            console.log('🔄 Retry response:', JSON.stringify(retryData, null, 2));
            
            if (retryResponse.ok) {
              // Success on retry - use retryData instead
              console.log('✅ Kopo Kopo STK Push successful (without metadata)');
              
              // Store transaction - continue with success flow
              const { error: txnError } = await supabaseAdmin
                .from('mpesa_transactions')
                .insert({
                  merchant_request_id: retryData.data?.id || `KK-${Date.now()}`,
                  checkout_request_id: retryData.data?.resource_id || `checkout-${Date.now()}`,
                  phone_number: phoneNumber,
                  amount: amount,
                  account_reference: accountReference,
                  transaction_desc: transactionDesc,
                  status: 'pending',
                  invoice_id: invoiceId || null,
                  payment_type: paymentType || 'rent',
                  initiated_by: user.id,
                  authorized_by: user.id,
                  provider: 'kopokopo',
                  metadata: {
                    reference: standardReference,
                    description: transactionDesc,
                    landlord_id: landlordConfigId,
                    provider: 'kopokopo',
                    till: tillNumber,
                    branch: 'no_metadata_success'
                  }
                });

              if (txnError) {
                console.error('Failed to store transaction:', txnError);
              }

              return new Response(
                JSON.stringify({ 
                  success: true,
                  provider: 'kopokopo',
                  tillNumber: tillNumber,
                  CheckoutRequestID: retryData.data?.resource_id || `checkout-${Date.now()}`,
                  MerchantRequestID: retryData.data?.id || `KK-${Date.now()}`,
                  message: 'Payment request sent successfully',
                  data: {
                    provider: 'kopokopo',
                    tillNumber: tillNumber,
                    CheckoutRequestID: retryData.data?.resource_id || `checkout-${Date.now()}`,
                    branch: 'no_metadata_success',
                    ...retryData
                  }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              userMessage = retryData.error_message || 'Failed to initiate payment even without metadata';
            }
          } else if (kopokopoData.error_message) {
            userMessage = kopokopoData.error_message;
          }
          
          return new Response(
            JSON.stringify({ 
              error: userMessage,
              errorId,
              userMessage,
              shouldRetry,
              details: kopokopoData
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Success response (snake_case payload worked with JSON body)
        console.log('✅ [SNAKE_SUCCESS] Kopo Kopo STK Push successful');
        
        const paymentRequestId = kopokopoData.data?.id || `kk-${Date.now()}`;

        // Store STK request in database
        await supabaseAdmin
          .from('mpesa_stk_requests')
          .insert({
            merchant_request_id: paymentRequestId,
            checkout_request_id: paymentRequestId,
            phone_number: phoneNumber,
            amount: amount,
            account_reference: accountReference || invoiceId,
            transaction_desc: transactionDesc || 'Kopo Kopo Payment',
            status: 'pending',
            invoice_id: invoiceId,
            payment_type: paymentType || 'rent',
            landlord_id: landlordConfigId,
            provider: 'kopokopo'
          });

        // Insert initial transaction record
        await supabaseAdmin
          .from('mpesa_transactions')
          .insert({
            merchant_request_id: paymentRequestId,
            checkout_request_id: paymentRequestId,
            result_code: '0',
            result_desc: 'STK Push initiated',
            phone_number: phoneNumber,
            amount: amount,
            status: 'pending',
            invoice_id: invoiceId || null,
            payment_type: paymentType || 'rent',
            initiated_by: user.id,
            authorized_by: user.id,
            provider: 'kopokopo',
            metadata: {
              reference: standardReference,
              description: transactionDesc,
              landlord_id: landlordConfigId,
              provider: 'kopokopo',
              till: tillNumber,
              branch: 'snake_json_ok'
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            provider: 'kopokopo',
            tillNumber: tillNumber,
            CheckoutRequestID: paymentRequestId,
            MerchantRequestID: paymentRequestId,
            message: 'STK push sent successfully. Please check your phone and enter your M-Pesa PIN.',
            data: {
              provider: 'kopokopo',
              tillNumber: tillNumber,
              CheckoutRequestID: paymentRequestId,
              ResponseDescription: 'Kopo Kopo STK push initiated',
              status: 'pending',
              branch: 'snake_json_ok'
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (kopokopoError) {
        console.error('❌ Kopo Kopo error:', kopokopoError);
        return new Response(
          JSON.stringify({ 
            error: 'Kopo Kopo payment processing failed',
            errorId: 'KOPOKOPO_REQUEST_FAILED',
            details: kopokopoError instanceof Error ? kopokopoError.message : 'Unknown error'
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // STANDARD M-PESA PAYMENT PROCESSING
    console.log('🔄 Processing payment via standard M-Pesa...');
    
    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      console.error('Missing M-Pesa credentials:', {
        missingConsumerKey: !consumerKey,
        missingConsumerSecret: !consumerSecret,
        missingPasskey: !passkey,
        missingShortcode: !shortcode,
        landlordConfigId
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'M-Pesa payment gateway not configured',
          errorId: 'MPESA_CONFIG_MISSING',
          landlordId: landlordConfigId,
          missing: {
            consumerKey: !consumerKey,
            consumerSecret: !consumerSecret,
            passkey: !passkey,
            shortcode: !shortcode
          }
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Dry run already handled above for both providers

    console.log('🔑 Fetching M-Pesa OAuth token...');
    console.log('🌍 M-Pesa environment (normalized):', environment);
    console.log('🔐 Credentials check:', {
      hasConsumerKey: !!consumerKey,
      hasConsumerSecret: !!consumerSecret,
      consumerKeyLength: consumerKey?.length,
      consumerSecretLength: consumerSecret?.length
    });
    
    // Get OAuth token
    const authUrl = environment === 'production' 
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    
    console.log('🔗 OAuth URL:', authUrl);

    const authResponse = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`
      }
    });

    const authData = await authResponse.json();
    
    console.log('📊 M-Pesa OAuth response:', {
      status: authResponse.status,
      ok: authResponse.ok,
      hasAccessToken: !!authData.access_token,
      tokenLength: authData.access_token?.length
    });
    
    if (!authResponse.ok || !authData.access_token) {
      console.error('❌ M-Pesa OAuth failed:', {
        status: authResponse.status,
        statusText: authResponse.statusText,
        data: authData,
        environment,
        authUrl,
        landlordId: landlordConfigId
      });
      return new Response(
        JSON.stringify({ 
          error: 'Failed to authenticate with M-Pesa',
          errorId: 'MPESA_TOKEN_FAILED',
          details: {
            status: authResponse.status,
            response: authData
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('✅ M-Pesa OAuth token obtained successfully');

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3)
    const password = btoa(`${shortcode}${passkey}${timestamp}`)
    
    console.log('🔐 Generated STK credentials:', {
      timestamp,
      shortcode,
      hasPassword: !!password
    });

    // Format phone number
    let phoneNumber = phone.toString().replace(/\D/g, '')
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.slice(1)
    } else if (!phoneNumber.startsWith('254')) {
      phoneNumber = '254' + phoneNumber
    }
    
    console.log('📞 Phone number formatted:', phoneNumber);

    // STK Push request
    const stkUrl = environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
    
    console.log('🔗 STK Push URL:', stkUrl);

    // Use custom callback URL if provided in config
    const callbackUrl = mpesaConfig?.callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;
    
    console.log('📞 Callback URL:', callbackUrl);

    // Determine transaction type based on shortcode type
    const transactionType = (mpesaConfig?.shortcode_type === 'till_safaricom' || mpesaConfig?.shortcode_type === 'till') 
      ? 'CustomerBuyGoodsOnline' 
      : 'CustomerPayBillOnline';
      
    console.log('💳 Transaction type:', transactionType);

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: Math.round(amount),
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: accountReference || (paymentType === 'service-charge' ? 'ZIRA-SERVICE' : `INV-${invoiceId}`),
      TransactionDesc: transactionDesc || (paymentType === 'service-charge' ? 'Zira Homes Service Charge' : 'Payment for ' + (accountReference || `INV-${invoiceId}`))
    }

    console.log('📤 STK Push payload:', JSON.stringify(stkPayload, null, 2));
    console.log('🚀 Sending STK push request to Safaricom API...');

    const stkResponse = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    })

    const stkData = await stkResponse.json();
    
    console.log('📥 STK Push response received:', {
      status: stkResponse.status,
      ok: stkResponse.ok,
      ResponseCode: stkData.ResponseCode,
      ResponseDescription: stkData.ResponseDescription,
      CheckoutRequestID: stkData.CheckoutRequestID,
      MerchantRequestID: stkData.MerchantRequestID,
      CustomerMessage: stkData.CustomerMessage
    });
    console.log('📦 Full STK response:', JSON.stringify(stkData, null, 2));

    if (stkData.ResponseCode === '0') {
      console.log('✅ STK push successful - creating transaction record');
      
      // Store the transaction in database with security tracking
      const transactionData = {
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        phone_number: phoneNumber,
        amount: Math.round(amount),
        status: 'pending',
        created_at: new Date().toISOString(),
        payment_type: paymentType || 'rent',
        initiated_by: user.id,
        authorized_by: user.id,
        provider: 'mpesa'
      }
      
      console.log('💾 Preparing transaction record:', {
        checkout_request_id: transactionData.checkout_request_id,
        amount: transactionData.amount,
        payment_type: transactionData.payment_type,
        initiated_by: transactionData.initiated_by
      });

      // Only add invoice_id if it's a valid UUID (for rent payments)
      if (invoiceId && paymentType !== 'service-charge') {
        transactionData.invoice_id = invoiceId
      }

      // For SMS bundle payments, store bundle metadata
      if (paymentType === 'sms_bundle' && requestBody.metadata) {
        transactionData.metadata = {
          payment_type: 'sms_bundle',
          bundle_id: requestBody.metadata.bundle_id,
          bundle_name: requestBody.metadata.bundle_name,
          sms_count: requestBody.metadata.sms_count,
          landlord_id: requestBody.metadata.landlord_id
        };
        console.log('Processing SMS bundle purchase:', transactionData.metadata);
      }

      // For service charge payments, store additional metadata
      if (paymentType === 'service-charge') {
        console.log('Processing service charge payment, validating invoice:', invoiceId);

        // Validate that the service charge invoice exists before processing
        if (invoiceId) {
          // Use admin client to bypass RLS for invoice validation
          const { data: serviceInvoice, error: invoiceCheckError } = await supabaseAdmin
            .from('service_charge_invoices')
            .select('id, status, invoice_number, total_amount, landlord_id')
            .eq('id', invoiceId)
            .maybeSingle()

          if (invoiceCheckError || !serviceInvoice) {
            console.error('Service charge invoice validation failed:', {
              invoiceId,
              error: invoiceCheckError,
              errorDetails: invoiceCheckError?.details,
              errorMessage: invoiceCheckError?.message
            });
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Service charge invoice not found',
                invoiceId: invoiceId,
                details: invoiceCheckError?.message
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }

          console.log('Service charge invoice validated successfully:', {
            id: serviceInvoice.id,
            invoice_number: serviceInvoice.invoice_number,
            status: serviceInvoice.status,
            total_amount: serviceInvoice.total_amount,
            landlord_id: serviceInvoice.landlord_id
          });

          if (serviceInvoice.status === 'paid') {
            console.warn('Service charge invoice already paid:', serviceInvoice.id);
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Service charge invoice already paid',
                invoiceId: invoiceId
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
        }

        transactionData.metadata = {
          service_charge_invoice_id: invoiceId,
          payment_type: 'service-charge',
          landlord_id: landlordConfigId
        }
        console.log('Service charge metadata added to transaction:', transactionData.metadata);
      } else if (paymentType === 'subscription') {
        // For subscription payments, store subscription metadata
        console.log('Processing subscription payment for user:', user.id);
        transactionData.metadata = {
          payment_type: 'subscription',
          landlord_id: user.id,
          account_reference: accountReference
        }
        console.log('Subscription metadata added to transaction:', transactionData.metadata);
      }

      console.log('Creating M-Pesa transaction record:', {
        checkout_request_id: transactionData.checkout_request_id,
        merchant_request_id: transactionData.merchant_request_id,
        phone_number: transactionData.phone_number,
        amount: transactionData.amount,
        payment_type: transactionData.payment_type,
        metadata: transactionData.metadata
      });

      const { error: dbError } = await supabase
        .from('mpesa_transactions')
        .insert(transactionData)

      if (dbError) {
        console.error('❌ DATABASE ERROR: Failed to insert transaction:', {
          error: dbError,
          errorMessage: dbError?.message,
          errorDetails: dbError?.details,
          errorCode: dbError?.code,
          transactionData: {
            checkout_request_id: transactionData.checkout_request_id,
            amount: transactionData.amount,
            payment_type: transactionData.payment_type
          }
        });
      } else {
        console.log('✅ Transaction record created successfully:', {
          checkout_request_id: transactionData.checkout_request_id,
          amount: transactionData.amount,
          payment_type: transactionData.payment_type
        });
      }

      console.log('🎉 STK PUSH COMPLETED SUCCESSFULLY - Returning success response');
      
      return new Response(
        JSON.stringify({
          success: true,
          CheckoutRequestID: stkData.CheckoutRequestID,
          MerchantRequestID: stkData.MerchantRequestID,
          message: 'STK push sent successfully',
          data: {
            CheckoutRequestID: stkData.CheckoutRequestID,
            MerchantRequestID: stkData.MerchantRequestID,
            ResponseDescription: stkData.ResponseDescription,
            BusinessShortCode: shortcode,
            UsingLandlordConfig: !!mpesaConfig
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.error('❌ STK PUSH FAILED:', {
        ResponseCode: stkData.ResponseCode,
        ResponseDescription: stkData.ResponseDescription,
        errorCode: stkData.errorCode,
        errorMessage: stkData.errorMessage,
        fullResponse: stkData
      });
      
      // Map specific error codes to errorIds
      let errorId = 'MPESA_STK_FAILED';
      if (stkData.errorCode === '404.001.03') {
        errorId = 'MPESA_INVALID_ACCESS_TOKEN';
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.ResponseDescription || stkData.errorMessage || 'STK push failed',
          errorId: errorId,
          data: stkData
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ CRITICAL ERROR in mpesa-stk-push:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
