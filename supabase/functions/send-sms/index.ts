import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  provider_name: string;
  phone_number: string;
  message: string;
  landlord_id?: string;
  provider_config: {
    api_key?: string;
    authorization_token?: string;
    username?: string;
    sender_id?: string;
    base_url?: string;
    unique_identifier?: string;
    sender_type?: string;
    config_data?: Record<string, any>;
  };
}

// Sanitize text for GSM-7 compatible SMS (remove/replace unsupported characters)
function sanitizeForSMS(input: string): string {
  if (!input) return '';
  let s = input;
  // Normalize quotes and dashes
  s = s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // double quotes
    .replace(/[\u2013\u2014\u2015]/g, '-') // dashes
    .replace(/\u00A0/g, ' '); // non-breaking space
  // Remove emojis and any non-ASCII except newline
  s = s.replace(/[^\x20-\x7E\n]/g, '');
  // Collapse excessive spaces and trim lines
  s = s
    .split('\n')
    .map(line => line.replace(/\s{2,}/g, ' ').trimEnd())
    .join('\n');
  return s.trim();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Detect internal/system calls
    const authHeader = req.headers.get('authorization');
    const internalCallHeader = req.headers.get('x-internal-call');
    const isInternalCall = 
      (authHeader && authHeader.includes(supabaseServiceKey)) || 
      internalCallHeader === 'true';

    let user = null;

    // For internal/system calls, bypass user authentication and role checks
    if (!isInternalCall) {
      // Normal flow: authenticate user
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !authenticatedUser) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      user = authenticatedUser;

      // Check if user has appropriate role (Admin, Landlord, Manager)
      const { data: hasValidRole, error: roleError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'Admin'
      });

      const { data: hasLandlordRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'Landlord'
      });

      const { data: hasManagerRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'Manager'
      });

      if (roleError || (!hasValidRole && !hasLandlordRole && !hasManagerRole)) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Insufficient permissions for SMS sending' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('🔓 Internal/system call detected - bypassing user authentication');
    }

    const requestBody = await req.json();
    const { phone_number, message, provider_id } = requestBody;
    
    // Input validation and sanitization
    if (!phone_number || !message) {
      return new Response(JSON.stringify({ error: 'Phone and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Validate phone number format
    const phoneRegex = /^(\+?254|0)?[17]\d{8}$/;
    if (!phoneRegex.test(phone_number.replace(/\s/g, ''))) {
      return new Response(JSON.stringify({ error: 'Invalid phone number format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Message length validation
    if (message.length > 1600) {
      return new Response(JSON.stringify({ error: 'Message too long (max 1600 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch provider configuration securely from database
    let provider = null;
    if (provider_id) {
      const { data: providerData, error: providerError } = await supabase
        .from('sms_providers')
        .select('*')
        .eq('id', provider_id)
        .eq('is_active', true)
        .single();

      if (providerError || !providerData) {
        console.error('SMS provider not found:', provider_id, providerError);
        return new Response(JSON.stringify({ error: 'SMS provider not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      provider = providerData;
    } else {
      // Get any active provider
      const { data: defaultProvider, error: defaultError } = await supabase
        .from('sms_providers')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (defaultError || !defaultProvider) {
        console.error('No active SMS provider found:', defaultError);
        return new Response(JSON.stringify({ error: 'No SMS provider configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      provider = defaultProvider;
    }

    // SSRF protection - enforce HTTPS and domain allowlist
    if (provider.base_url) {
      const url = new URL(provider.base_url);
      const allowedDomains = ['advantasms.com', 'twilio.com', 'africastalking.com', 'roberms.com', 'endpint.roberms.com'];
      const allowedHttpIPs = ['68.183.101.252']; // Trusted InHouse SMS provider
      
      // Allow HTTPS domains or specific trusted HTTP IPs
      const isHttpsTrustedDomain = url.protocol === 'https:' && 
        allowedDomains.some(domain => url.hostname.endsWith(domain));
      const isHttpTrustedIP = url.protocol === 'http:' && 
        allowedHttpIPs.includes(url.hostname);
      
      if (!isHttpsTrustedDomain && !isHttpTrustedIP) {
        console.error('Blocked unsafe SMS provider URL:', provider.base_url);
        return new Response(JSON.stringify({ error: 'SMS provider not supported' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const sanitizedMessage = sanitizeForSMS(message || "");

    console.log('SMS Request:', { 
      provider_name: provider.provider_name, 
      phone_number: `***${phone_number.slice(-4)}`, // Mask phone number in logs
      message_length: sanitizedMessage.length 
    });

    // Enhanced SSRF protection - this block was incorrectly referencing provider_config
    // The provider configuration is already fetched securely from database above

    let smsResponse;
    let smsStatus = 'pending';
    let smsCost = 2.50; // Default cost per SMS in KES

    try {
      switch (provider.provider_name.toLowerCase()) {
        case 'inhouse sms':
          smsResponse = await sendInHouseSMS(phone_number, sanitizedMessage, provider);
          smsStatus = 'sent';
          break;
        case 'twilio':
          smsResponse = await sendTwilioSMS(phone_number, sanitizedMessage, provider);
          smsStatus = 'sent';
          break;
        case "africa's talking":
          smsResponse = await sendAfricasTalkingSMS(phone_number, sanitizedMessage, provider);
          smsStatus = 'sent';
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${provider.provider_name}`);
      }
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
      smsStatus = 'failed';
      throw smsError;
    }

    // Record SMS usage in database 
    if (user) {
      try {
        const { error: usageError } = await supabase
          .from('sms_usage_logs')
          .insert({
            landlord_id: user.id,
            recipient_phone: `***${phone_number.slice(-4)}`, // Masked phone number
            message_content: `[${sanitizedMessage.length} chars]`, // Length only, no content
            cost: smsCost,
            status: smsStatus,
            provider_name: provider.provider_name,
            sent_at: new Date().toISOString()
          });

        if (usageError) {
          console.error('Error recording SMS usage:', usageError);
        } else {
          console.log('SMS usage recorded successfully');
        }
      } catch (dbError) {
        console.error('Database error while recording SMS usage:', dbError);
      }
    }

    console.log('SMS sent successfully via provider:', provider.provider_name);

    return new Response(JSON.stringify({
      success: true,
      provider: provider.provider_name,
      message: 'SMS sent successfully',
      cost: smsCost
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error sending SMS:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

async function sendInHouseSMS(phone: string, message: string, provider: any) {
  // Prefer INHOUSE_SMS_URL from env (HTTPS) over provider.base_url
  let baseUrl = Deno.env.get('INHOUSE_SMS_URL') || provider.base_url || 'https://api.example.com/sms/';
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }
  
  console.log('Using InHouse SMS URL:', baseUrl);
  
  // Force POST method for reliable body delivery
  const httpMethod = 'POST';
  
  // Enhanced phone number validation and formatting
  let formattedPhone = phone.replace(/\D/g, '');
  
  if (formattedPhone.length < 9) {
    throw new Error(`Invalid phone number format: ${phone}. Must be at least 9 digits.`);
  }
  
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith('7') && formattedPhone.length === 9) {
    formattedPhone = '254' + formattedPhone;
  } else if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }
  
  if (!formattedPhone.startsWith('254') || formattedPhone.length !== 12) {
    throw new Error(`Invalid Kenyan phone number: ${phone}. Expected format: +254XXXXXXXXX`);
  }

  const dataSet = [{
    username: provider.username || 'ZIRA TECH',
    phone_number: formattedPhone,
    unique_identifier: provider.unique_identifier || '77',
    sender_name: provider.sender_id || 'ZIRA TECH',
    message: message,
    sender_type: parseInt(provider.sender_type || '10')
  }];

  const requestBody = {
    dataSet: dataSet,
    timeStamp: Math.floor(Date.now() / 1000)
  };

  // SECURITY: Use environment variables for SMS credentials
  // First try config_data, then direct authorization_token, then environment
  let authToken = provider.config_data?.authorization_token || provider.authorization_token;
  
  // If credentials are encrypted or missing, use environment variables
  if (!authToken || authToken === '[REDACTED]' || authToken.length < 10) {
    authToken = Deno.env.get('INHOUSE_SMS_TOKEN') || Deno.env.get('SMS_PROVIDER_TOKEN');
  }
  
  if (!authToken) {
    console.error('SMS authentication token missing. Provider config:', {
      hasConfigData: !!provider.config_data,
      hasAuthToken: !!provider.authorization_token,
      providerName: provider.provider_name
    });
    throw new Error('SMS provider authentication token not configured. Please contact administrator.');
  }
  
  console.log('Using auth token from:', provider.config_data?.authorization_token ? 'config_data' : 'environment');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Token ${authToken}`,
    'User-Agent': 'Zira-Homes-SMS-Service/1.0'
  };

  console.log('InHouse SMS Request:', {
    url: baseUrl,
    method: httpMethod,
    phone: formattedPhone,
    messageLength: message.length,
    headers: { ...headers, Authorization: 'Token ***' }
  });

  const response = await fetch(baseUrl, {
    method: httpMethod,
    headers: headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(15000) // 15 second timeout
  });

  if (!response.ok) {
    const responseText = await response.text();
    const errorMsg = `SMS API error: ${response.status} ${response.statusText} - ${responseText}`;
    console.error('InHouse SMS Error:', errorMsg);
    throw new Error(errorMsg);
  }

  const responseText = await response.text();
  console.log('InHouse SMS Response:', responseText);
  try {
    return JSON.parse(responseText);
  } catch {
    return { success: true, raw_response: responseText };
  }
}

async function sendTwilioSMS(phone: string, message: string, config: any) {
  // Twilio implementation placeholder
  throw new Error('Twilio SMS not implemented yet');
}

async function sendAfricasTalkingSMS(phone: string, message: string, config: any) {
  // Africa's Talking implementation placeholder
  throw new Error("Africa's Talking SMS not implemented yet");
}

serve(handler);