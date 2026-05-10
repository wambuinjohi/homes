import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EnhancedBillingPage } from "@/components/landlord/EnhancedBillingPage";

const LandlordBillingPage = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-3 sm:p-4 lg:p-6">
        <EnhancedBillingPage />
      </div>
    </DashboardLayout>
  );
};

export default LandlordBillingPage;