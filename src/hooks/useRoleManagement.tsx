import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type AppRole = 'Admin' | 'Landlord' | 'Manager' | 'Agent' | 'Tenant';

interface RoleChangeRequest {
  userId: string;
  role: AppRole;
  reason?: string;
}

interface RoleManagementResult {
  success: boolean;
  message: string;
  error?: string;
}

export const useRoleManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const canAssignRole = useCallback(async (targetRole: AppRole): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('can_assign_role', {
        _assigner_id: user.id,
        _target_role: targetRole
      });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking role assignment permission:', error);
      return false;
    }
  }, [user]);

  const canRemoveRole = useCallback(async (targetUserId: string, targetRole: AppRole): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('can_remove_role', {
        _remover_id: user.id,
        _target_user_id: targetUserId,
        _target_role: targetRole
      });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking role removal permission:', error);
      return false;
    }
  }, [user]);

  const assignRole = useCallback(async (request: RoleChangeRequest): Promise<RoleManagementResult> => {
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    setLoading(true);
    try {
      // Check permission first
      const hasPermission = await canAssignRole(request.role);
      if (!hasPermission) {
        return { 
          success: false, 
          message: `You don't have permission to assign ${request.role} role` 
        };
      }

      // Check if user already has this role
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', request.userId)
        .eq('role', request.role)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRole) {
        return {
          success: false,
          message: `User already has ${request.role} role`
        };
      }

      // Check for role conflicts before assigning
      const existingRoles = await getUserRoles(request.userId);
      const roleConflicts: Record<AppRole, AppRole[]> = {
        'Admin': ['Landlord', 'Tenant', 'Manager', 'Agent'],
        'Landlord': ['Admin', 'Tenant'],
        'Tenant': ['Admin', 'Landlord', 'Manager', 'Agent'],
        'Manager': ['Admin', 'Tenant'],
        'Agent': ['Admin', 'Tenant'],
      };

      const conflicts = roleConflicts[request.role] || [];
      const hasConflict = existingRoles.some(existing => 
        conflicts.includes(existing as AppRole)
      );

      if (hasConflict) {
        const conflictingRole = existingRoles.find(r => conflicts.includes(r as AppRole));
        return {
          success: false,
          message: `Cannot assign ${request.role} role: User already has ${conflictingRole} role which conflicts`
        };
      }

      // Assign the role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: request.userId,
          role: request.role
        });

      if (error) throw error;

      toast({
        title: "Role Assigned",
        description: `Successfully assigned ${request.role} role to user`,
      });

      return {
        success: true,
        message: `Successfully assigned ${request.role} role`
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to assign role';
      toast({
        title: "Assignment Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        message: 'Failed to assign role',
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [user, canAssignRole, toast]);

  const removeRole = useCallback(async (request: RoleChangeRequest): Promise<RoleManagementResult> => {
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    setLoading(true);
    try {
      // Check permission first
      const hasPermission = await canRemoveRole(request.userId, request.role);
      if (!hasPermission) {
        return { 
          success: false, 
          message: `You don't have permission to remove ${request.role} role` 
        };
      }

      // Remove the role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', request.userId)
        .eq('role', request.role);

      if (error) throw error;

      toast({
        title: "Role Removed",
        description: `Successfully removed ${request.role} role from user`,
      });

      return {
        success: true,
        message: `Successfully removed ${request.role} role`
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to remove role';
      toast({
        title: "Removal Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        message: 'Failed to remove role',
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [user, canRemoveRole, toast]);

  const getUserRoles = useCallback(async (targetUserId: string): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId);

      if (error) throw error;
      return data?.map(r => r.role as AppRole) || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  }, []);

  const validateRoleHierarchy = useCallback((userRole: AppRole, targetRole: AppRole): boolean => {
    const hierarchy: Record<string, number> = {
      'Admin': 5,
      'Landlord': 4,
      'Manager': 3,
      'Agent': 2,
      'Tenant': 1,
      'SubUser': 0  // SubUser has lowest priority, cannot override other roles
    };

    return (hierarchy[userRole] || 0) >= (hierarchy[targetRole] || 0);
  }, []);

  return {
    assignRole,
    removeRole,
    canAssignRole,
    canRemoveRole,
    getUserRoles,
    validateRoleHierarchy,
    loading
  };
};