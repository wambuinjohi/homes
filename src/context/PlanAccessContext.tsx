import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { usePlanFeatureAccess, FEATURES, type Feature } from "@/hooks/usePlanFeatureAccess";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface PlanAccessContextType {
  checkAccess: (feature: Feature, currentCount?: number) => {
    allowed: boolean;
    is_limited: boolean;
    limit?: number;
    remaining?: number;
    plan_name?: string;
    loading: boolean;
  };
  hasFeature: (feature: Feature) => boolean;
  canCreateUnit: (currentCount: number) => boolean;
  canSendSMS: (currentUsage: number) => boolean;
  planName?: string;
  loading: boolean;
}

const PlanAccessContext = createContext<PlanAccessContextType | null>(null);

export const usePlanAccess = (): PlanAccessContextType => {
  const context = useContext(PlanAccessContext);
  if (!context) {
    throw new Error("usePlanAccess must be used within a PlanAccessProvider");
  }
  return context;
};

interface PlanAccessProviderProps {
  children: ReactNode;
}

export const PlanAccessProvider = ({ children }: PlanAccessProviderProps) => {
  const { user } = useAuth();
  const { 
    loading: globalLoading,
    refetch 
  } = usePlanFeatureAccess();

  // Listen for real-time plan changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('plan-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'landlord_subscriptions',
          filter: `landlord_id=eq.${user.id}`
        },
        () => {
          console.log('Plan change detected, refetching access...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  const checkAccess = (feature: Feature, currentCount?: number) => {
    if (!user) {
      return {
        allowed: false,
        is_limited: true,
        loading: false,
        plan_name: undefined,
      };
    }

    // Return a placeholder - actual checks will be done by individual hooks
    return {
      allowed: true, // Default for now - components will use hooks directly
      is_limited: false,
      loading: false,
      plan_name: undefined,
    };
  };

  const hasFeature = (feature: Feature): boolean => {
    // Components should use hooks directly
    return true; // Default for now
  };

  const canCreateUnit = (currentCount: number): boolean => {
    // Components should use hooks directly
    return true; // Default for now
  };

  const canSendSMS = (currentUsage: number): boolean => {
    // Components should use hooks directly  
    return true; // Default for now
  };

  const value: PlanAccessContextType = {
    checkAccess,
    hasFeature,
    canCreateUnit,
    canSendSMS,
    loading: globalLoading,
  };

  return (
    <PlanAccessContext.Provider value={value}>
      {children}
    </PlanAccessContext.Provider>
  );
};