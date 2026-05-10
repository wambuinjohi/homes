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

    const { operation, userId, ...params } = await req.json();
    const userAgent = req.headers.get('user-agent') || '';
    const rawIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const clientIP = rawIP ? rawIP.split(',')[0].trim() : null;

    let result;

    switch (operation) {
      case 'suspend_user':
        result = await suspendUser(supabaseAdmin, userId, user.id, userAgent, clientIP);
        break;
      
      case 'activate_user':
        result = await activateUser(supabaseAdmin, userId, user.id, userAgent, clientIP);
        break;
      
      case 'reset_password':
        result = await resetPassword(supabaseAdmin, userId, user.id, userAgent, clientIP, params);
        break;
      
      case 'reset_trial':
        result = await resetTrial(supabaseAdmin, userId, user.id, userAgent, clientIP, params);
        break;
      
      case 'revoke_sessions':
        result = await revokeSessions(supabaseAdmin, userId, user.id, userAgent, clientIP, params);
        break;
      
      case 'start_impersonation':
        result = await startImpersonation(supabaseAdmin, userId, user.id, userAgent, clientIP);
        break;
      
      case 'stop_impersonation':
        result = await stopImpersonation(supabaseAdmin, userId, user.id, userAgent, clientIP);
        break;
      
      case 'soft_delete_user':
        result = await softDeleteUser(supabaseAdmin, userId, user.id, userAgent, clientIP);
        break;
      
      case 'permanently_delete_user':
        result = await permanentlyDeleteUser(supabaseAdmin, userId, user.id, userAgent, clientIP);
        break;
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin user operation error:', error);
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

async function suspendUser(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string) {
  // Update user status
  const { error } = await supabase.rpc('suspend_user', { _user_id: userId });
  if (error) throw error;

  // Revoke all active sessions
  await supabase
    .from('user_sessions')
    .update({ 
      is_active: false,
      logout_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_active', true);

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'suspend',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { old_status: 'active', new_status: 'suspended' },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { success: true, message: 'User suspended successfully' };
}

async function activateUser(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string) {
  // Update user status
  const { error } = await supabase.rpc('activate_user', { _user_id: userId });
  if (error) throw error;

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'activate',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { old_status: 'suspended', new_status: 'active' },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { success: true, message: 'User activated successfully' };
}

async function resetPassword(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string, params: any) {
  // Get user email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', userId)
    .single();

  if (!profile) throw new Error('User not found');

  // Send password reset (using existing function)
  const { data: resetResult, error } = await supabase.functions.invoke('send-password-reset', {
    body: {
      user_id: userId,
      user_email: profile.email,
      user_name: `${profile.first_name} ${profile.last_name}`.trim(),
      reset_by_admin: true
    }
  });

  if (error) throw error;

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'password_reset_by_admin',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { channels_used: resetResult?.channels_used },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { 
    success: true, 
    message: 'Password reset sent successfully',
    channels_used: resetResult?.channels_used
  };
}

async function resetTrial(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string, params: any) {
  const { trialDays = 30 } = params;
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + trialDays);

  // Update subscription
  const { error } = await supabase
    .from('landlord_subscriptions')
    .update({
      status: 'trial',
      trial_start_date: new Date().toISOString(),
      trial_end_date: trialEndDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('landlord_id', userId);

  if (error) throw error;

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'trial_reset',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { trial_days: trialDays, new_end_date: trialEndDate },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { 
    success: true, 
    message: `Trial reset successfully for ${trialDays} days`,
    trial_end_date: trialEndDate
  };
}

async function revokeSessions(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string, params: any) {
  const { sessionId, revokeAll = false } = params;

  let updatedCount = 0;

  if (revokeAll) {
    // Revoke all active sessions
    const { data, error } = await supabase
      .from('user_sessions')
    .update({ 
      is_active: false,
      logout_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('id');

    if (error) throw error;
    updatedCount = data?.length || 0;
  } else if (sessionId) {
    // Revoke specific session
  const { error } = await supabase
      .from('user_sessions')
      .update({ 
        is_active: false,
        logout_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) throw error;
    updatedCount = 1;
  }

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: revokeAll ? 'all_sessions_revoked' : 'session_revoked',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { sessions_revoked: updatedCount, session_id: sessionId || null },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { 
    success: true, 
    message: `${updatedCount} session${updatedCount !== 1 ? 's' : ''} revoked successfully`,
    sessions_revoked: updatedCount
  };
}

async function startImpersonation(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string) {
  // Check if target user is admin (forbidden)
  const { data: targetRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (targetRole?.role === 'Admin') {
    throw new Error('Cannot impersonate admin users');
  }

  // Create impersonation session (expires in 30 minutes)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);
  const sessionToken = crypto.randomUUID();

  const { data: session, error } = await supabase
    .from('impersonation_sessions')
    .insert({
      admin_user_id: adminId,
      impersonated_user_id: userId,
      session_token: sessionToken,
      ip_address: clientIP,
      user_agent: userAgent,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'impersonation_started',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { session_id: session.id, expires_at: expiresAt },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { 
    success: true, 
    message: 'Impersonation session started',
    session_id: session.id,
    expires_at: expiresAt
  };
}

async function stopImpersonation(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string) {
  // End impersonation session
  const { error } = await supabase
    .from('impersonation_sessions')
    .update({ 
      ended_at: new Date().toISOString(),
      is_active: false
    })
    .eq('admin_user_id', adminId)
    .eq('impersonated_user_id', userId)
    .eq('is_active', true);

  if (error) throw error;

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'impersonation_ended',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { previous_state: 'impersonating' },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { success: true, message: 'Impersonation session ended' };
}

async function softDeleteUser(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string) {
  // Check for dependencies
  const dependencies = await checkUserDependencies(supabase, userId);
  
  if (dependencies.hasActiveLeases || dependencies.hasActiveProperties) {
    return {
      success: false,
      error: 'Cannot delete user with active dependencies',
      dependencies,
      transfer_required: true
    };
  }

  // Soft delete using database function
  const { error } = await supabase.rpc('soft_delete_user', { _user_id: userId });
  if (error) throw error;

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'soft_delete',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { previous_status: 'active', new_status: 'deleted' },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { success: true, message: 'User soft deleted successfully' };
}

async function permanentlyDeleteUser(supabase: any, userId: string, adminId: string, userAgent: string, clientIP: string) {
  // Check for dependencies
  const dependencies = await checkUserDependencies(supabase, userId);
  
  if (dependencies.hasAnyData) {
    return {
      success: false,
      error: 'Cannot permanently delete user with existing data',
      dependencies
    };
  }

  // Get user info for audit log
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', userId)
    .single();

  // Delete from auth system
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.warn('Could not delete auth user:', authError);
  }

  // Delete profile and roles (cascading will handle other references)
  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);

  // Log audit
  await supabase.rpc('log_user_audit', {
    _user_id: userId,
    _action: 'permanent_delete',
    _entity_type: 'user',
    _entity_id: userId,
    _details: { 
      deleted_user_email: profile?.email,
      deleted_user_name: `${profile?.first_name} ${profile?.last_name}`.trim()
    },
    _performed_by: adminId,
    _ip_address: clientIP || null,
    _user_agent: userAgent
  });

  return { success: true, message: 'User permanently deleted successfully' };
}

async function checkUserDependencies(supabase: any, userId: string) {
  // Check for properties
  const { data: properties } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', userId);

  // Check for active leases as tenant
  const { data: tenantLeases } = await supabase
    .from('leases')
    .select('id')
    .eq('tenant_id', userId)
    .eq('status', 'active');

  // Check for payments
  const { data: payments } = await supabase
    .from('payments')
    .select('id')
    .eq('tenant_id', userId);

  // Check for maintenance requests
  const { data: maintenanceRequests } = await supabase
    .from('maintenance_requests')
    .select('id')
    .eq('tenant_id', userId);

  return {
    hasActiveProperties: (properties?.length || 0) > 0,
    hasActiveLeases: (tenantLeases?.length || 0) > 0,
    hasPayments: (payments?.length || 0) > 0,
    hasMaintenanceRequests: (maintenanceRequests?.length || 0) > 0,
    hasAnyData: (properties?.length || 0) > 0 || 
                (tenantLeases?.length || 0) > 0 || 
                (payments?.length || 0) > 0 || 
                (maintenanceRequests?.length || 0) > 0,
    counts: {
      properties: properties?.length || 0,
      activeLeases: tenantLeases?.length || 0,
      payments: payments?.length || 0,
      maintenanceRequests: maintenanceRequests?.length || 0
    }
  };
}