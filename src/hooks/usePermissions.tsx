import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/context/RoleContext';

export interface SubUserPermissions {
  manage_properties: boolean;
  manage_tenants: boolean;
  manage_leases: boolean;
  manage_maintenance: boolean;
  manage_payments: boolean;
  view_reports: boolean;
  manage_expenses: boolean;
  send_messages: boolean;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const { isSubUser, subUserPermissions } = useRole();
  const [permissions, setPermissions] = useState<SubUserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      // If user is a sub-user, use their assigned permissions
      if (isSubUser && subUserPermissions) {
        setPermissions(subUserPermissions as any as SubUserPermissions);
        setLoading(false);
        return;
      }

      // For non-sub-users, grant all permissions
      setPermissions({
        manage_properties: true,
        manage_tenants: true,
        manage_leases: true,
        manage_maintenance: true,
        manage_payments: true,
        view_reports: true,
        manage_expenses: true,
        send_messages: true,
      });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, [user, isSubUser, subUserPermissions]);

  const hasPermission = useCallback((permission: keyof SubUserPermissions | string) => {
    if (!permissions) return false;
    
    // For sub-user permissions
    if (permission in permissions) {
      const value = permissions[permission as keyof SubUserPermissions];
      // Explicitly treat undefined/null as false
      return value === true;
    }
    
    // For admin/other permissions, always return true for non-sub-users
    return !isSubUser;
  }, [permissions, isSubUser]);

  const hasAnyPermission = useCallback((permissionList: (keyof SubUserPermissions | string)[]) => {
    return permissionList.some(permission => hasPermission(permission));
  }, [hasPermission]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    refetch: fetchUserPermissions
  };
};