import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";

interface RoleBasedRouteProps {
  children: React.ReactNode;
}

export const RoleBasedRoute = ({ children }: RoleBasedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { effectiveRole, assignedRoles, loading: roleLoading } = useRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Helper to check if we're in actual tenant area (not /tenants which is for landlords)
  const isTenantArea = location.pathname === "/tenant" || location.pathname.startsWith("/tenant/");
  
  // Redirect from "/dashboard" based on effectiveRole (the currently selected/active role)
  if (location.pathname === "/dashboard") {
    if (effectiveRole === "tenant") {
      return <Navigate to="/tenant" replace />;
    }
    if (effectiveRole === "admin") {
      return <Navigate to="/admin" replace />;
    }
    // Landlord, manager, agent stay on main dashboard
  }

  // Block tenant-only users from accessing non-tenant routes
  if (effectiveRole === "tenant" && !isTenantArea && location.pathname !== "/auth" && assignedRoles.length === 1) {
    return <Navigate to="/tenant" replace />;
  }

  // Block non-tenant users from accessing tenant routes (unless they have tenant role)
  if (isTenantArea && !assignedRoles.includes("tenant")) {
    return <Navigate to="/dashboard" replace />;
  }

  // Block non-admin users from accessing admin routes
  if (location.pathname.startsWith("/admin") && effectiveRole !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
