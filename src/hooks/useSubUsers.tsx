import { useState, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SubUser {
  id: string;
  landlord_id: string;
  user_id?: string;
  title?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    manage_payments: boolean;
    view_reports: boolean;
    manage_expenses: boolean;
    send_messages: boolean;
  };
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
}

export interface CreateSubUserData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  title?: string;
  password?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    manage_payments: boolean;
    view_reports: boolean;
    manage_expenses: boolean;
    send_messages: boolean;
  };
}

export const useSubUsers = () => {
  const { user, session } = useAuth();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSubUsers = async () => {
    if (!user) {
      console.log('No authenticated user, skipping sub-user fetch');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Fetching sub-users for landlord:', user.id);
      
      // Use supabase client invoke for better error handling and fallbacks
      const { data, error } = await supabase.functions.invoke('list-landlord-sub-users', {
        body: {}
      });

      if (error) {
        console.error('Failed to fetch sub-users:', error);
        toast.error('Error Loading Sub-Users', {
          description: `Failed to load sub-users. ${error.message || 'Please try again.'}`
        });
        setSubUsers([]);
        return;
      }

      console.log('Sub-users fetch result:', data);

      if (data?.success && data?.data) {
        console.log('Setting sub-users:', data.data.length);
        
        // Transform the data
        const transformedData: SubUser[] = (data.data || []).map((item: any) => {
          // Handle profiles as either a nested object or array (Supabase can return either)
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
          
          return {
            ...item,
            permissions: typeof item.permissions === 'string' 
              ? JSON.parse(item.permissions) 
              : item.permissions,
            profiles: profile ? {
              first_name: profile.first_name,
              last_name: profile.last_name,
              email: profile.email,
              phone: profile.phone
            } : undefined
          };
        });
        
        setSubUsers(transformedData);
        
        // Show info toast if no sub-users found
        if (transformedData.length === 0) {
          toast.info('No Sub-Users', {
            description: 'No active sub-users found for this account'
          });
        }
      } else {
        console.error('Sub-users fetch unsuccessful:', data);
        toast.error('Error Loading Sub-Users', {
          description: data?.error || 'Could not load sub-users'
        });
        setSubUsers([]);
      }
    } catch (error: any) {
      console.error('Error fetching sub-users:', error);
      toast.error('Error', {
        description: error.message || 'Failed to load sub-users'
      });
      setSubUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const createSubUser = async (data: CreateSubUserData) => {
    if (!user) return;

    let access: string | null = session?.access_token || null;
    if (!access) {
      try { const { data: s } = await supabase.auth.getSession(); access = s?.session?.access_token || null; } catch {}
    }

    const diagnostics: any[] = [];

    try {
      // 1) Server proxy (service-role) — richest error details
      try {
        const payload = {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          title: data.title || null,
          password: data.password || null,
          permissions: data.permissions,
          ...(user?.id ? { landlord_id: user.id } : {})
        };
        
        const res = await fetch('/api/edge/create-sub-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
            ...(user?.id ? { 'x-landlord-id': user.id } : {}),
          },
          body: JSON.stringify(payload)
        });
        const text = await res.text().catch(() => '');
        let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }

        if (!res.ok || !parsed?.success) {
          diagnostics.push({ source: 'server-proxy', status: res.status, statusText: res.statusText, body: parsed ?? text });
          throw new Error('server-proxy failed');
        }

        const wasCustomPassword = data.password && data.password.trim().length > 0;
        const title = parsed.password_reset ? "Sub-User Linked - Password Reset" : "Sub-User Created";
        
        let credentialsText: string;
        if (wasCustomPassword) {
          credentialsText = `Sub-user ${parsed.password_reset ? 'linked' : 'created'} successfully with your custom password.\n\nEmail: ${data.email}`;
        } else if (parsed.temporary_password) {
          credentialsText = `Email: ${data.email}\nPassword: ${parsed.temporary_password}\n\n${parsed.instructions || 'Share these credentials securely'}`;
        } else {
          credentialsText = parsed.message || "Sub-user added successfully";
        }
        
        toast.success(title, { 
          description: credentialsText,
          duration: 15000, // 15 seconds for credentials
        });
        fetchSubUsers();
        return;
      } catch (e) {}

      // 2) Supabase functions.invoke with explicit auth header
      let invokeResp: any = null;
      try {
        invokeResp = await (supabase.functions as any).invoke('create-sub-user', {
          body: { ...data },
          headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}) }
        });
      } catch (fnErr: any) {
        let details = fnErr?.message || 'Edge function invocation failed';
        try {
          if (fnErr?.response && typeof fnErr.response.text === 'function') {
            const txt = await fnErr.response.text();
            try { const j = JSON.parse(txt); details = j.error || j.message || j.details || JSON.stringify(j); } catch { details = txt; }
          }
        } catch {}
        diagnostics.push({ source: 'invoke-throw', name: fnErr?.name || null, status: fnErr?.status || null, details });
        throw new Error('invoke-throw');
      }

      const iErr = invokeResp?.error || null;
      const iData = invokeResp?.data ?? invokeResp;
      if (iErr || !iData?.success) {
        diagnostics.push({
          source: 'invoke-result',
          name: iErr?.name || null,
          status: iErr?.status || iErr?.context?.response?.status || iData?.status || null,
          message: iErr?.message || iData?.error || iData?.message || null,
          details: iErr?.details || iErr?.context || iData?.details || null,
          raw: iData || null,
        });

        // 3) Direct function URL fetch to capture raw body
        try {
          const fnUrl = `${(SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/create-sub-user`;
          const r = await fetch(fnUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_PUBLISHABLE_KEY,
              ...(access ? { 'Authorization': `Bearer ${access}` } : {}),
            },
            body: JSON.stringify({ ...data })
          });
          const txt = await r.text().catch(() => '');
          let j: any; try { j = JSON.parse(txt); } catch { j = null; }
          diagnostics.push({ source: 'direct-function', status: r.status, statusText: r.statusText, body: j ?? txt });
        } catch (dfErr: any) {
          diagnostics.push({ source: 'direct-function-error', message: dfErr?.message || String(dfErr) });
        }

        throw new Error('invoke-result failed');
      }

      const wasCustomPassword = data.password && data.password.trim().length > 0;
      const title = iData.password_reset ? "Sub-User Linked - Password Reset" : "Sub-User Created";
      
      let credentialsText: string;
      if (wasCustomPassword) {
        credentialsText = `Sub-user ${iData.password_reset ? 'linked' : 'created'} successfully with your custom password.\n\nEmail: ${data.email}`;
      } else if (iData.temporary_password) {
        credentialsText = `Email: ${data.email}\nPassword: ${iData.temporary_password}\n\n${iData.instructions || 'Share these credentials securely'}`;
      } else {
        credentialsText = iData.message || "Sub-user added successfully";
      }
      
      toast.success(title, { 
        description: credentialsText,
        duration: 15000, // 15 seconds for credentials
      });
      fetchSubUsers();
      return;
    } catch (primaryError: any) {
      console.error('create-sub-user failed:', primaryError, diagnostics);

      // Friendly ACL hint if backend enforces landlord role
      let friendly: string | null = null;
      try {
        for (const d of diagnostics) {
          const msg = (d && (d.message || d.statusText)) ? String(d.message || d.statusText) : '';
          if (/only\s+landlords\s+can\s+create\s+sub-users/i.test(msg)) { friendly = 'Only landlords can create sub-users. Switch to a Landlord account or have an admin assign you the Landlord role.'; break; }
          const body = (d && d.body) as any;
          if (typeof body === 'string' && /only\s+landlords\s+can\s+create\s+sub-users/i.test(body)) { friendly = 'Only landlords can create sub-users. Switch to a Landlord account or have an admin assign you the Landlord role.'; break; }
          if (body && typeof body === 'object') {
            const inner = (body.error || body.message || body.details || '') + '';
            if (/only\s+landlords\s+can\s+create\s+sub-users/i.test(inner)) { friendly = 'Only landlords can create sub-users. Switch to a Landlord account or have an admin assign you the Landlord role.'; break; }
          }
        }
      } catch {}

      if (friendly) {
        toast.error(friendly);
        throw new Error(friendly);
      }

      // Show user-friendly error message
      const errorMessage = primaryError?.message || 'Failed to create sub-user. Please try again.';
      
      // Extract the most relevant error detail for the user
      let detailMessage = '';
      try {
        for (const d of diagnostics) {
          if (d.body && typeof d.body === 'object' && d.body.error) {
            detailMessage = d.body.error;
            break;
          }
          if (d.message && typeof d.message === 'string') {
            detailMessage = d.message;
            break;
          }
        }
      } catch {}
      
      toast.error("Failed to Create Sub-User", {
        description: detailMessage || errorMessage,
        duration: 8000,
      });
      
      // Log full diagnostics for debugging
      console.error('Full error diagnostics:', { error: primaryError, diagnostics });
      
      throw new Error(errorMessage);
    }
  };

  const updateSubUserPermissions = async (subUserId: string, permissions: SubUser['permissions']) => {
    try {
      const { error } = await supabase
        .from('sub_users')
        .update({ permissions })
        .eq('id', subUserId);

      if (error) throw error;

      toast.success('Permissions updated successfully');
      fetchSubUsers();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const deactivateSubUser = async (subUserId: string) => {
    try {
      const { error } = await supabase
        .from('sub_users')
        .update({ status: 'inactive' })
        .eq('id', subUserId);

      if (error) throw error;

      toast.success('Sub-user access revoked');
      fetchSubUsers();
    } catch (error) {
      console.error('Error deactivating sub-user:', error);
      toast.error('Failed to revoke access');
    }
  };

  useEffect(() => {
    fetchSubUsers();
  }, [user]);

  return {
    subUsers,
    loading,
    createSubUser,
    updateSubUserPermissions,
    deactivateSubUser,
    refetch: fetchSubUsers
  };
};
