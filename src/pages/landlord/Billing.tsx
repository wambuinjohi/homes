import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EnhancedBillingPage } from "@/components/landlord/EnhancedBillingPage";

const Billing = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Redirect legacy details tab to main billing page
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "details") {
      navigate("/billing", { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-3 sm:p-4 lg:p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
              <p className="text-muted-foreground">
                Manage your subscription, payments, and billing preferences
              </p>
            </div>
          </div>

          <EnhancedBillingPage />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Billing;