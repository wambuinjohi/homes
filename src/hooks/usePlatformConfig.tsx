import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PlatformMpesaConfig {
  shortcode: string;
  environment: string;
  display_name: string;
  shortcode_type: string;
  account_reference: string;
}

interface PlatformConfig {
  mpesa: PlatformMpesaConfig | null;
}

export function usePlatformConfig() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "platform_mpesa_config")
        .single();

      if (error) throw error;

      return {
        mpesa: (data?.setting_value || null) as unknown as PlatformMpesaConfig | null,
      } as PlatformConfig;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  return {
    config: data,
    isLoading,
    error,
    mpesaShortcode: data?.mpesa?.shortcode,
    mpesaEnvironment: data?.mpesa?.environment,
    mpesaDisplayName: data?.mpesa?.display_name,
  };
}
