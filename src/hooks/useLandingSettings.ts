import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LandingSettings {
  trialDays: number;
  isLoading: boolean;
}

export function useLandingSettings(): LandingSettings {
  const { data, isLoading } = useQuery({
    queryKey: ["landing-trial-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_settings")
        .select("setting_value")
        .eq("setting_key", "trial_settings")
        .maybeSingle();

      if (error) {
        console.error("Error fetching trial settings:", error);
        return null;
      }

      const settings = data?.setting_value as Record<string, unknown> | null;
      return settings?.trial_period_days as number | undefined;
    },
    staleTime: 1000 * 60 * 60,
  });

  return {
    trialDays: data ?? 14,
    isLoading,
  };
}
