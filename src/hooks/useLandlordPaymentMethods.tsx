import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PaymentMethod {
  type: "mpesa" | "jenga" | "bank";
  name: string;
  isEnabled: boolean;
  config?: {
    merchantCode?: string;
    paybillNumber?: string;
    accountFormat?: string;
    instructions?: string;
  };
}

interface LandlordPaymentInfo {
  landlordId: string | null;
  merchantCode: string | null;
  unitNumber: string | null;
  propertyName: string | null;
  paymentMethods: PaymentMethod[];
  hasActivePaymentMethods: boolean;
}

export function useLandlordPaymentMethods() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["landlord-payment-methods", user?.id],
    queryFn: async (): Promise<LandlordPaymentInfo> => {
      if (!user?.id) {
        return {
          landlordId: null,
          merchantCode: null,
          unitNumber: null,
          propertyName: null,
          paymentMethods: [],
          hasActivePaymentMethods: false,
        };
      }

      // Get tenant info
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (tenantError || !tenant) {
        console.error("Error fetching tenant:", tenantError);
        return {
          landlordId: null,
          merchantCode: null,
          unitNumber: null,
          propertyName: null,
          paymentMethods: [],
          hasActivePaymentMethods: false,
        };
      }

      // Get active lease with unit and property info
      const { data: lease, error: leaseError } = await supabase
        .from("leases")
        .select(`
          id,
          units:unit_id (
            id,
            unit_number,
            properties:property_id (
              id,
              name,
              owner_id
            )
          )
        `)
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .maybeSingle();

      if (leaseError || !lease) {
        console.error("Error fetching lease:", leaseError);
        return {
          landlordId: null,
          merchantCode: null,
          unitNumber: null,
          propertyName: null,
          paymentMethods: [],
          hasActivePaymentMethods: false,
        };
      }

      const unit = lease.units as any;
      const property = unit?.properties as any;
      const landlordId = property?.owner_id;
      const unitNumber = unit?.unit_number;
      const propertyName = property?.name;

      if (!landlordId) {
        return {
          landlordId: null,
          merchantCode: null,
          unitNumber,
          propertyName,
          paymentMethods: [],
          hasActivePaymentMethods: false,
        };
      }

      const paymentMethods: PaymentMethod[] = [];

      // Check for Jenga PAY config (Equity Bank)
      const { data: jengaConfig } = await supabase
        .from("landlord_jenga_configs")
        .select("merchant_code, paybill_number, is_active")
        .eq("landlord_id", landlordId)
        .eq("is_active", true)
        .maybeSingle();

      if (jengaConfig?.is_active) {
        paymentMethods.push({
          type: "jenga",
          name: "Equity Bank (247247)",
          isEnabled: true,
          config: {
            merchantCode: jengaConfig.merchant_code,
            paybillNumber: jengaConfig.paybill_number || "247247",
            accountFormat: `${jengaConfig.merchant_code}-${unitNumber}`,
            instructions: `Pay to Paybill 247247, Account: ${jengaConfig.merchant_code}-${unitNumber}`,
          },
        });
      }

      // Check for KCB Buni config
      const { data: kcbConfig } = await supabase
        .from("landlord_bank_configs")
        .select("merchant_code, is_active")
        .eq("landlord_id", landlordId)
        .eq("bank_code", "kcb")
        .eq("is_active", true)
        .maybeSingle();

      if (kcbConfig?.is_active) {
        paymentMethods.push({
          type: "bank",
          name: "KCB Bank (522522)",
          isEnabled: true,
          config: {
            merchantCode: kcbConfig.merchant_code,
            paybillNumber: "522522",
            accountFormat: `${kcbConfig.merchant_code}-${unitNumber}`,
            instructions: `Pay to Paybill 522522, Account: ${kcbConfig.merchant_code}-${unitNumber}`,
          },
        });
      }

      // Check for M-Pesa config
      const { data: mpesaConfig } = await supabase
        .from("landlord_mpesa_configs")
        .select("business_shortcode, paybill_number, till_number, shortcode_type, is_active")
        .eq("landlord_id", landlordId)
        .eq("is_active", true)
        .maybeSingle();

      if (mpesaConfig?.is_active) {
        const paymentNumber = mpesaConfig.paybill_number || mpesaConfig.till_number || mpesaConfig.business_shortcode;
        const isPaybill = mpesaConfig.shortcode_type === "paybill";
        
        paymentMethods.push({
          type: "mpesa",
          name: isPaybill ? "M-Pesa Paybill" : "M-Pesa Till",
          isEnabled: true,
          config: {
            paybillNumber: paymentNumber,
            accountFormat: isPaybill ? unitNumber : undefined,
            instructions: isPaybill
              ? `Pay to Paybill ${paymentNumber}, Account: ${unitNumber}`
              : `Pay to Till ${paymentNumber}`,
          },
        });
      }

      return {
        landlordId,
        merchantCode: jengaConfig?.merchant_code || null,
        unitNumber,
        propertyName,
        paymentMethods,
        hasActivePaymentMethods: paymentMethods.length > 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
