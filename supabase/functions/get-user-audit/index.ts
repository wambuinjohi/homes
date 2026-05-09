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
    const limit = parseInt(requestBody.limit || '50');
    const offset = parseInt(requestBody.offset || '0');

    if (!targetUserId) {
      throw new Error('User ID is required');
    }

    // Use the database function to get audit history
    const { data: auditLogs, error } = await supabaseAdmin
      .rpc('get_user_audit_history', {
        _user_id: targetUserId,
        _limit: limit,
        _offset: offset
      });

    if (error) throw error;

    // Also get some summary stats
    const todayLogs = auditLogs?.filter((log: any) => {
      const logDate = new Date(log.created_at);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }) || [];

    const thisWeekLogs = auditLogs?.filter((log: any) => {
      const logDate = new Date(log.created_at);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return logDate > oneWeekAgo;
    }) || [];

    return new Response(JSON.stringify({
      success: true,
      logs: auditLogs || [],
      summary: {
        total: auditLogs?.length || 0,
        today: todayLogs.length,
        this_week: thisWeekLogs.length
      },
      pagination: {
        limit,
        offset,
        has_more: (auditLogs?.length || 0) === limit
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get user audit error:', error);
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