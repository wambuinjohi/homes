import { Navigate } from "react-router-dom";
import { useRole } from "@/context/RoleContext";
import { Loader2 } from "lucide-react";

interface SubUserBlockedRouteProps {
  children: React.ReactNode;
}

/**
 * Blocks sub-users from accessing administrative routes
 * Redirects to dashboard if sub-user attempts to access
 */
export function SubUserBlockedRoute({ children }: SubUserBlockedRouteProps) {
  const { isSubUser, loading } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect sub-users to dashboard
  if (isSubUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
