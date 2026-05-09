import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { UserX, Shield } from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedUser } = useImpersonation();

  const exitImpersonation = () => {
    // Clear impersonation state and reload
    localStorage.removeItem('impersonatedUser');
    window.location.reload();
  };

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  return (
    <Alert className="border-warning bg-warning/10 text-warning-foreground sticky top-0 z-50 rounded-none border-b-2">
      <Shield className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span className="font-medium">
          🔐 ADMIN MODE: You are viewing as {impersonatedUser.email || 'Unknown User'}
        </span>
        <Button
          onClick={exitImpersonation}
          size="sm"
          variant="outline"
          className="ml-4 border-warning text-warning hover:bg-warning hover:text-warning-foreground"
        >
          <UserX className="h-3 w-3 mr-1" />
          Exit Impersonation
        </Button>
      </AlertDescription>
    </Alert>
  );
};