import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserActivity } from "@/hooks/useUserActivity";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, User, Shield, Clock } from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useNavigate } from "react-router-dom";
interface UserImpersonationDialogProps {
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    user_roles: Array<{ role: string }>;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserImpersonationDialog({ user, open, onOpenChange }: UserImpersonationDialogProps) {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const { toast } = useToast();
  const { logActivity } = useUserActivity();
  const { startImpersonation } = useImpersonation();
  const navigate = useNavigate();

  const handleImpersonate = async () => {
    if (!user) return;

    setIsImpersonating(true);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: 'start_impersonation',
          userId: user.id
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to start impersonation");
      }

      toast({
        title: "Impersonation Started",
        description: `You are now viewing the application as ${user.first_name} ${user.last_name}. Session expires in 30 minutes.`,
        duration: 5000,
      });

      // Update local impersonation context and navigate to the correct portal
      startImpersonation(user, userRole);
      const roleLower = (userRole || '').toLowerCase();
      const targetPath = roleLower === 'tenant' 
        ? '/tenant' 
        : roleLower === 'landlord' 
          ? '/landlord/billing' 
          : '/';

      onOpenChange(false);
      navigate(targetPath, { replace: true });
    } catch (error) {
      console.error('Error starting impersonation:', error);
      toast({
        title: "Error",
        description: "Failed to start user impersonation",
        variant: "destructive",
      });
    } finally {
      setIsImpersonating(false);
    }
  };

  if (!user) return null;

  const userRole = user.user_roles?.[0]?.role || "No Role";
  const userName = `${user.first_name} ${user.last_name}`.trim() || user.email || "Unknown User";

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "Landlord":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Agent":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Tenant":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Impersonate User
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Warning:</strong> Impersonating a user will give you access to their account and data. 
              This action will be logged for security auditing.
            </AlertDescription>
          </Alert>

          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">{userName}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge className={getRoleBadgeColor(userRole)}>
                {userRole}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">What happens when you impersonate:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Session will be logged with timestamps
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                All actions will be tracked and auditable
              </li>
              <li className="flex items-center gap-2">
                <User className="h-3 w-3" />
                You'll see the app from their perspective
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImpersonate}
            disabled={isImpersonating}
            className="bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            {isImpersonating ? "Starting..." : "Start Impersonation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}