import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as LucideIcons from "lucide-react";

interface PaymentMethodDisplay {
  icon: string;
  label: string;
  color: string;
}

interface PaymentMethodMetadata {
  id: string;
  payment_method_type: string;
  provider_name: string;
  country_code: string;
  display: PaymentMethodDisplay;
}

export function usePaymentMethodMetadata(countryCode?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["payment-method-metadata", countryCode],
    queryFn: async () => {
      let query = supabase
        .from("approved_payment_methods")
        .select("id, payment_method_type, provider_name, country_code, configuration")
        .eq("is_active", true);

      if (countryCode) {
        query = query.eq("country_code", countryCode);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((method) => ({
        id: method.id,
        payment_method_type: method.payment_method_type,
        provider_name: method.provider_name,
        country_code: method.country_code,
        display: (method.configuration as any)?.display || {
          icon: "CreditCard",
          label: method.payment_method_type,
          color: "gray",
        },
      })) as PaymentMethodMetadata[];
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  const getIcon = (paymentType: string) => {
    const method = data?.find((m) => m.payment_method_type === paymentType);
    const iconName = method?.display?.icon || "CreditCard";
    return (LucideIcons as any)[iconName] || LucideIcons.CreditCard;
  };

  const getLabel = (paymentType: string) => {
    const method = data?.find((m) => m.payment_method_type === paymentType);
    return method?.display?.label || paymentType;
  };

  const getColor = (paymentType: string) => {
    const method = data?.find((m) => m.payment_method_type === paymentType);
    return method?.display?.color || "gray";
  };

  return {
    methods: data || [],
    isLoading,
    error,
    getIcon,
    getLabel,
    getColor,
  };
}
