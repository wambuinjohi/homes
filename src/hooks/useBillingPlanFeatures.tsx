import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanFeature {
  feature_key: string;
  display_name: string;
  description: string | null;
  category: 'core' | 'advanced' | 'premium' | 'enterprise';
  icon_name: string | null;
  is_enabled: boolean;
  custom_limit: number | null;
}

export interface CategorizedFeatures {
  core: PlanFeature[];
  advanced: PlanFeature[];
  premium: PlanFeature[];
  enterprise: PlanFeature[];
}

export function useBillingPlanFeatures(planId?: string) {
  return useQuery({
    queryKey: ['billing-plan-features', planId],
    queryFn: async () => {
      if (!planId) {
        // Fetch all features without plan-specific enablement
        const { data, error } = await supabase
          .from('plan_features' as any)
          .select('*')
          .eq('is_active', true)
          .order('category')
          .order('sort_order');

        if (error) throw error;

        const features = (data || []).map((f: any) => ({
          feature_key: f.feature_key,
          display_name: f.display_name,
          description: f.description,
          category: f.category as PlanFeature['category'],
          icon_name: f.icon_name,
          is_enabled: false,
          custom_limit: null
        }));

        return categorizeFeatures(features);
      }

      // Fetch features for specific plan using RPC
      const { data, error } = await supabase.rpc('get_plan_features' as any, {
        plan_id: planId
      });

      if (error) throw error;

      const features = (data || []).map((f: any) => ({
        feature_key: f.feature_key,
        display_name: f.display_name,
        description: f.description || null,
        category: f.category as PlanFeature['category'],
        icon_name: f.icon_name || null,
        is_enabled: f.is_enabled || false,
        custom_limit: f.custom_limit || null
      }));
      
      return categorizeFeatures(features);
    },
    enabled: true
  });
}

function categorizeFeatures(features: PlanFeature[]): CategorizedFeatures {
  return {
    core: features.filter(f => f.category === 'core'),
    advanced: features.filter(f => f.category === 'advanced'),
    premium: features.filter(f => f.category === 'premium'),
    enterprise: features.filter(f => f.category === 'enterprise')
  };
}

// Hook to get features for multiple plans (for comparison)
export function useMultiplePlanFeatures(planIds: string[]) {
  return useQuery({
    queryKey: ['multiple-plan-features', ...planIds],
    queryFn: async () => {
      const planFeatures: Record<string, CategorizedFeatures> = {};

      for (const planId of planIds) {
        const { data, error } = await supabase.rpc('get_plan_features' as any, {
          plan_id: planId
        });

        if (error) throw error;

        const features = (data || []).map((f: any) => ({
          feature_key: f.feature_key,
          display_name: f.display_name,
          description: f.description || null,
          category: f.category as PlanFeature['category'],
          icon_name: f.icon_name || null,
          is_enabled: f.is_enabled || false,
          custom_limit: f.custom_limit || null
        }));
        
        planFeatures[planId] = categorizeFeatures(features);
      }

      return planFeatures;
    },
    enabled: planIds.length > 0
  });
}

// Get the required plan tier for a feature
export function getFeatureTier(featureKey: string): 'starter' | 'professional' | 'enterprise' | 'core' {
  if (featureKey.includes('enterprise') || featureKey.startsWith('branding.') || featureKey.startsWith('integrations.')) {
    return 'enterprise';
  }
  if (featureKey.includes('premium') || featureKey.includes('advanced') || featureKey.startsWith('team.') || featureKey.startsWith('communication.')) {
    return 'professional';
  }
  if (featureKey.includes('basic') || featureKey.startsWith('reports.basic') || featureKey.startsWith('expenses.')) {
    return 'starter';
  }
  return 'core';
}

// Get plan name for a tier
export function getPlanNameForTier(tier: 'starter' | 'professional' | 'enterprise' | 'core'): string {
  const names = {
    core: 'Trial',
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
  };
  return names[tier];
}
