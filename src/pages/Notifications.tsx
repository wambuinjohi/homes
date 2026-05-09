import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TenantNotificationPortal } from "@/components/notifications/TenantNotificationPortal";
import { useAuth } from "@/hooks/useAuth";

const Notifications = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("filter") || "all";
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <TenantNotificationPortal initialFilter={initialFilter} />
      </div>
    </DashboardLayout>
  );
};

export default Notifications;