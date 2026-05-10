import { Navigate } from "react-router-dom";
import { useRole } from "@/context/RoleContext";
import { SubUserPermissions } from "@/hooks/usePermissions";
import { Loader2, Lock } from "lucide-react";

interface PermissionGuardProps {
  permission: keyof SubUserPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Guards content based on sub-user permissions
 * - Non-sub-users: Full access
 * - Sub-users: Check specific permission (always enforced)
 */
export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { isSubUser, subUserPermissions, loading } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Non-sub-users have full access
  if (!isSubUser) {
    return <>{children}</>;
  }

  // SECURE BY DEFAULT: Check specific permission for sub-users
  // Fail closed: If permissions not loaded or undefined, deny access
  const hasPermission = subUserPermissions?.[permission] === true;

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Default fallback with helpful message
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Permission Required</h2>
          <p className="text-muted-foreground">
            You don't have permission to access this feature. Please contact your account owner to request access.
          </p>
          <button 
            onClick={() => window.history.back()} 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
