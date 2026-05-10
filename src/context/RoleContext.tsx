import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { measureApiCall } from "@/utils/performanceMonitor";

interface RoleContextType {
  userRole: string | null;
  effectiveRole: string | null;
  assignedRoles: string[];
  isAdmin: boolean;
  isLandlord: boolean;
  isTenant: boolean;
  isManager: boolean;
  isAgent: boolean;
  isSubUser: boolean;
  subUserPermissions: Record<string, boolean> | null;
  landlordId?: string | null;
  isOnLandlordTrial?: boolean;
  accountType?: 'landlord' | 'agency' | null;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
};

interface RoleProviderProps {
  children: ReactNode;
}

export const RoleProvider = ({ children }: RoleProviderProps) => {
  const { user } = useAuth();
  const { isImpersonating, impersonatedRole } = useImpersonation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [subUserPermissions, setSubUserPermissions] = useState<Record<string, boolean> | null>(null);
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [isOnLandlordTrial, setIsOnLandlordTrial] = useState(false);
  const [accountType, setAccountType] = useState<'landlord' | 'agency' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setAssignedRoles([]);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        // If impersonating, set role from impersonation context
        if (isImpersonating && impersonatedRole) {
          setUserRole(impersonatedRole.toLowerCase());
          setAssignedRoles([impersonatedRole.toLowerCase()]);
          setLoading(false);
          return;
        }

        // Fetch ALL roles assigned to the user (not just single)
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (rolesError) {
          console.error("Error fetching roles:", rolesError);
          setUserRole(null);
          setAssignedRoles([]);
          setLoading(false);
          return;
        }

        const allRoles = rolesData?.map(r => r.role.toLowerCase()) || [];
        setAssignedRoles(allRoles);

        // Smart role resolution with priority order
        // Priority: Admin > Landlord > SubUser > Manager/Agent > Tenant
        let resolvedRole: string | null = null;

        if (allRoles.includes('admin')) {
          resolvedRole = 'admin';
        } else if (allRoles.includes('landlord')) {
          // Verify they have a subscription
          const { data: sub } = await supabase
            .from('landlord_subscriptions')
            .select('id, status, trial_end_date')
            .eq('landlord_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (sub) {
            resolvedRole = 'landlord';
            
            // Set account type from subscription
            setAccountType((sub as any).account_type || 'landlord');
            
            // Check if on trial
            if (sub.status === 'trial' && sub.trial_end_date) {
              const trialEndDate = new Date(sub.trial_end_date);
              setIsOnLandlordTrial(trialEndDate > new Date());
            }
          } else {
            console.warn('User has Landlord role but no subscription found');
          }
        } else if (allRoles.includes('subuser')) {
          // Verify they're in sub_users table
          const { data: subUserData } = await supabase.rpc('get_my_sub_user_permissions');
          const subUserInfo = subUserData as { permissions?: Record<string, boolean>; landlord_id?: string; status?: string } | null;
          
          if (subUserInfo && (subUserInfo.permissions || subUserInfo.status)) {
            resolvedRole = 'subuser';
            if (subUserInfo.permissions) setSubUserPermissions(subUserInfo.permissions);
            setLandlordId(subUserInfo.landlord_id || null);
            
            // Check if the landlord is on trial
            if (subUserInfo.landlord_id) {
              const { data: landlordSubscription } = await supabase
                .from('landlord_subscriptions')
                .select('status, trial_end_date')
                .eq('landlord_id', subUserInfo.landlord_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (landlordSubscription?.status === 'trial' && landlordSubscription?.trial_end_date) {
                const trialEndDate = new Date(landlordSubscription.trial_end_date);
                setIsOnLandlordTrial(trialEndDate > new Date());
              }
            }
          } else {
            console.warn('User has SubUser role but no sub_users record found');
          }
        } else if (allRoles.includes('manager')) {
          resolvedRole = 'manager';
        } else if (allRoles.includes('agent')) {
          resolvedRole = 'agent';
        } else if (allRoles.includes('tenant')) {
          // Verify they're actually linked to a tenant record (not just email match)
          const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (tenant) {
            resolvedRole = 'tenant';
          } else {
            console.warn('User has Tenant role but no linked tenant record found');
          }
        }

        // Fallback: check auth metadata if no valid role found
        if (!resolvedRole && allRoles.length === 0) {
          const metadataRole = user.user_metadata?.role?.toLowerCase();
          if (metadataRole) {
            resolvedRole = metadataRole;
            console.warn('Using fallback role from auth metadata:', metadataRole);
          }
        }

        // Log if role conflicts detected
        if (allRoles.length > 1) {
          console.log(`Multiple roles detected for user: ${allRoles.join(', ')}. Resolved to: ${resolvedRole}`);
        }

        setUserRole(resolvedRole);
      } catch (error) {
        console.error("Error in fetchUserRole:", error);
        setUserRole(null);
        setAssignedRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user, isImpersonating, impersonatedRole]);

  // Calculate effective role (only impersonation can override, no role switching)
  const effectiveRole = (isImpersonating && impersonatedRole)
    ? impersonatedRole.toLowerCase()
    : userRole;

  // Role flags
  const isAdmin = effectiveRole === "admin";
  const isLandlord = effectiveRole === "landlord";
  const isTenant = effectiveRole === "tenant";
  const isManager = effectiveRole === "manager";
  const isAgent = effectiveRole === "agent";
  const isSubUser = effectiveRole === "subuser";

  const value: RoleContextType = {
    userRole,
    effectiveRole,
    assignedRoles,
    isAdmin,
    isLandlord,
    isTenant,
    isManager,
    isAgent,
    isSubUser,
    subUserPermissions,
    landlordId,
    isOnLandlordTrial,
    accountType,
    loading,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};
