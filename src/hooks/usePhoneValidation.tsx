import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserCountry } from "./useUserCountry";

interface PhoneValidationRule {
  regex: string;
  format: string;
  placeholder: string;
  country_code: string;
  display_name: string;
}

interface PhoneValidationRules {
  [countryCode: string]: PhoneValidationRule;
}

export function usePhoneValidation() {
  const { primaryCountry } = useUserCountry();

  const { data, isLoading, error } = useQuery({
    queryKey: ["phone-validation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_settings")
        .select("setting_value")
        .eq("setting_key", "phone_validation_rules")
        .single();

      if (error) throw error;

      return (data.setting_value || {}) as unknown as PhoneValidationRules;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  const currentCountryRules = data?.[primaryCountry || "KE"];

  const validatePhone = (phone: string) => {
    if (!currentCountryRules) return true;
    const regex = new RegExp(currentCountryRules.regex);
    return regex.test(phone);
  };

  const formatPhone = (phone: string) => {
    if (!currentCountryRules) return phone;
    
    // Remove all non-numeric characters except +
    const cleaned = phone.replace(/[^\d+]/g, "");
    
    // If doesn't start with country code, add it
    if (!cleaned.startsWith(currentCountryRules.country_code)) {
      // Remove leading 0 if present
      const withoutLeadingZero = cleaned.startsWith("0") ? cleaned.substring(1) : cleaned;
      return currentCountryRules.country_code + withoutLeadingZero;
    }
    
    return cleaned;
  };

  return {
    rules: currentCountryRules,
    allRules: data,
    isLoading,
    error,
    validatePhone,
    formatPhone,
    placeholder: currentCountryRules?.placeholder || "+254712345678",
    format: currentCountryRules?.format || "+254XXXXXXXXX",
    countryCode: currentCountryRules?.country_code || "+254",
  };
}
