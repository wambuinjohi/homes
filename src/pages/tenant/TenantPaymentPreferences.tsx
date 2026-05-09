import React from "react";
import { TenantPaymentPreferences } from "@/components/tenant/TenantPaymentPreferences";
import { TenantLayout } from "@/components/TenantLayout";

export default function TenantPaymentPreferencesPage() {
  return (
    <TenantLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <TenantPaymentPreferences />
      </div>
    </TenantLayout>
  );
}