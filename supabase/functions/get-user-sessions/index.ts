import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Check if user is admin
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (userRole?.role !== 'Admin') {
      throw new Error('Insufficient permissions');
    }

    // Get request body
    const requestBody = await req.json();
    const targetUserId = requestBody.userId;
    const limit = parseInt(requestBody.limit || '20');

    if (!targetUserId) {
      throw new Error('User ID is required');
    }

    // Fetch user sessions
    const { data: sessions, error } = await supabaseAdmin
      .from('user_sessions')
      .select(`
        id,
        login_at,
        logout_at,
        ip_address,
        user_agent,
        is_active,
        last_activity,
        created_at,
        updated_at
      `)
      .eq('user_id', targetUserId)
      .order('login_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Count active sessions
    const activeSessions = sessions?.filter(s => s.is_active) || [];
    const recentSessions = sessions?.filter(s => {
      const loginTime = new Date(s.login_at);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return loginTime > oneDayAgo;
    }) || [];

    return new Response(JSON.stringify({
      success: true,
      sessions: sessions || [],
      summary: {
        total: sessions?.length || 0,
        active: activeSessions.length,
        recent_24h: recentSessions.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get user sessions error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});