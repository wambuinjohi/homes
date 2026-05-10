import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  provider: string | null;
  checks: {
    database: { status: string; message?: string };
    provider_config: { status: string; message?: string; provider?: any };
    api_connectivity: { status: string; message?: string; response_time_ms?: number };
    authentication: { status: string; message?: string };
  };
  timestamp: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Tolerant authentication - attempt to identify caller but don't block
    let callerType = 'none';
    let userId: string | null = null;
    
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (!authError && user) {
          userId = user.id;
          
          // Check if user is admin
          const { data: isAdmin } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'Admin'
          });
          
          callerType = isAdmin ? 'admin' : 'user';
        } else {
          callerType = 'anon';
        }
      } catch {
        callerType = 'anon';
      }
    }

    const healthCheck: HealthCheckResponse = {
      status: 'healthy',
      provider: null,
      checks: {
        database: { status: 'unknown' },
        provider_config: { status: 'unknown' },
        api_connectivity: { status: 'unknown' },
        authentication: { status: 'unknown' }
      },
      timestamp: new Date().toISOString()
    };

    // Check 1: Database connectivity
    try {
      const { error: dbError } = await supabase
        .from('sms_providers')
        .select('id')
        .limit(1);
      
      if (dbError) throw dbError;
      
      healthCheck.checks.database = {
        status: 'pass',
        message: 'Database connection successful'
      };
    } catch (error: any) {
      healthCheck.checks.database = {
        status: 'fail',
        message: error.message
      };
      healthCheck.status = 'unhealthy';
    }

    // Check 2: SMS Provider Configuration
    try {
      const { data: provider, error: providerError } = await supabase
        .from('sms_providers')
        .select('*')
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

      if (providerError) throw providerError;
      
      if (!provider) {
        throw new Error('No active default SMS provider configured');
      }

      healthCheck.provider = provider.provider_name;
      
      // Sanitize provider config (remove credentials)
      const safeProvider = {
        id: provider.id,
        provider_name: provider.provider_name,
        base_url: provider.base_url,
        is_active: provider.is_active,
        is_default: provider.is_default,
        has_auth_token: !!provider.auth_token,
        has_api_key: !!provider.api_key
      };

      healthCheck.checks.provider_config = {
        status: 'pass',
        message: `Provider configured: ${provider.provider_name}`,
        provider: safeProvider
      };
    } catch (error: any) {
      healthCheck.checks.provider_config = {
        status: 'fail',
        message: error.message
      };
      healthCheck.status = 'unhealthy';
    }

    // Check 3: API Connectivity (if provider configured)
    if (healthCheck.checks.provider_config.status === 'pass') {
      try {
        const { data: provider } = await supabase
          .from('sms_providers')
          .select('*')
          .eq('is_active', true)
          .eq('is_default', true)
          .single();

        if (provider) {
          // Prefer INHOUSE_SMS_URL from env over provider.base_url
          let testUrl = Deno.env.get('INHOUSE_SMS_URL') || provider.base_url;
          if (testUrl) {
            testUrl = testUrl.replace(/\/$/, '');
            
            const startTime = Date.now();
            
            // Test basic connectivity (GET request without body)
            const response = await fetch(testUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Zira-SMS-Health-Check/1.0'
              },
              signal: AbortSignal.timeout(10000) // 10 second timeout
            }).catch(() => null);

            const responseTime = Date.now() - startTime;

            // Consider 2xx-4xx as reachable (API is up), only 5xx or network failure as down
            if (response && response.status < 500) {
              healthCheck.checks.api_connectivity = {
                status: 'pass',
                message: `API endpoint reachable (HTTP ${response.status})`,
                response_time_ms: responseTime
              };
            } else {
              healthCheck.checks.api_connectivity = {
                status: 'fail',
                message: `API endpoint returned status: ${response?.status || 'unreachable'}`,
                response_time_ms: responseTime
              };
              healthCheck.status = 'degraded';
            }
          }
        }
      } catch (error: any) {
        healthCheck.checks.api_connectivity = {
          status: 'fail',
          message: `Connection error: ${error.message}`
        };
        healthCheck.status = 'degraded';
      }
    }

    // Check 4: Authentication credentials
    if (healthCheck.checks.provider_config.status === 'pass') {
      try {
        const { data: provider } = await supabase
          .from('sms_providers')
          .select('auth_token, api_key, provider_name, authorization_token, config_data')
          .eq('is_active', true)
          .eq('is_default', true)
          .single();

        // Check multiple token sources (matching send-sms logic)
        const envAuthToken = Deno.env.get("INHOUSE_SMS_AUTH_TOKEN");
        const envApiKey = Deno.env.get("INHOUSE_SMS_API_KEY");
        const envToken = Deno.env.get("INHOUSE_SMS_TOKEN");

        const hasDbCredentials = !!(
          provider?.auth_token || 
          provider?.api_key || 
          provider?.authorization_token ||
          provider?.config_data?.authorization_token
        );
        const hasEnvCredentials = !!(envAuthToken || envApiKey || envToken);

        if (hasDbCredentials || hasEnvCredentials) {
          healthCheck.checks.authentication = {
            status: 'pass',
            message: `Credentials available (DB: ${hasDbCredentials}, ENV: ${hasEnvCredentials}). Caller: ${callerType}`
          };
        } else {
          healthCheck.checks.authentication = {
            status: 'fail',
            message: `No authentication credentials found in database or environment. Caller: ${callerType}`
          };
          healthCheck.status = 'unhealthy';
        }
      } catch (error: any) {
        healthCheck.checks.authentication = {
          status: 'fail',
          message: error.message
        };
        healthCheck.status = 'degraded';
      }
    }

    // Overall status determination
    const failedChecks = Object.values(healthCheck.checks).filter(c => c.status === 'fail').length;
    const passedChecks = Object.values(healthCheck.checks).filter(c => c.status === 'pass').length;

    if (failedChecks > 0) {
      healthCheck.status = failedChecks > 1 ? 'unhealthy' : 'degraded';
    } else if (passedChecks === Object.keys(healthCheck.checks).length) {
      healthCheck.status = 'healthy';
    }

    console.log('SMS Health Check Result:', JSON.stringify(healthCheck, null, 2));

    return new Response(
      JSON.stringify(healthCheck),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("Error in sms-health-check:", error);
    return new Response(
      JSON.stringify({ 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
