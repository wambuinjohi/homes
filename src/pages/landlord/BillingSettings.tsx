
import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LandlordPaymentPreferences } from "@/components/landlord/LandlordPaymentPreferences";

const BillingSettings = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-3 sm:p-4 lg:p-6">
        <LandlordPaymentPreferences />
      </div>
    </DashboardLayout>
  );
};

export default BillingSettings;
