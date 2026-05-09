import React from "react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UnitCapGateProps {
  children: React.ReactNode;
  action?: "create" | "view";
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export function UnitCapGate({ 
  children, 
  action = "view",
  fallbackTitle = "Unit Limit Reached",
  fallbackDescription = "Upgrade your plan to add more units and scale your property management business."
}: UnitCapGateProps) {
  const { user } = useAuth();

  // Get current unit count
  const { data: unitCount = 0 } = useQuery({
    queryKey: ['unit-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('units')
        .select('*, properties!inner(*)', { count: 'exact', head: true })
        .eq('properties.owner_id', user.id);
        
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const currentCount = action === "create" ? unitCount + 1 : unitCount;

  return (
    <FeatureGate
      feature={FEATURES.UNITS_MAX}
      variant="compact"
      currentCount={currentCount}
      fallbackTitle={fallbackTitle}
      fallbackDescription={fallbackDescription}
    >
      {children}
    </FeatureGate>
  );
}