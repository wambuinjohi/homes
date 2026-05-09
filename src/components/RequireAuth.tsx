import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface RequireAuthProps {
  children: React.ReactNode;
}

export const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="space-y-4 w-full">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">
            Verifying your access...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login but preserve the attempted location
    return (
      <Navigate 
        to="/auth" 
        replace 
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
};