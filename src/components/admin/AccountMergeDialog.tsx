import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, User, Merge } from "lucide-react";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  user_roles?: Array<{ role: string }>;
}

interface AccountMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryUser: UserProfile;
  duplicateUser: UserProfile;
  onMergeComplete: () => void;
}

export function AccountMergeDialog({ 
  open, 
  onOpenChange, 
  primaryUser, 
  duplicateUser,
  onMergeComplete 
}: AccountMergeDialogProps) {
  const [merging, setMerging] = useState(false);
  const { toast } = useToast();

  const handleMergeAccounts = async () => {
    try {
      setMerging(true);

      // 1. Transfer all related data from duplicate to primary user
      // Update tenants
      await supabase
        .from('tenants')
        .update({ user_id: primaryUser.id })
        .eq('user_id', duplicateUser.id);

      // Update properties ownership
      await supabase
        .from('properties')
        .update({ owner_id: primaryUser.id })
        .eq('owner_id', duplicateUser.id);

      // Update properties management
      await supabase
        .from('properties')
        .update({ manager_id: primaryUser.id })
        .eq('manager_id', duplicateUser.id);

      // Update maintenance requests
      await supabase
        .from('maintenance_requests')
        .update({ last_updated_by: primaryUser.id })
        .eq('last_updated_by', duplicateUser.id);

      // Update notification preferences
      await supabase
        .from('notification_preferences')
        .update({ user_id: primaryUser.id })
        .eq('user_id', duplicateUser.id);

      // Update landlord subscriptions
      await supabase
        .from('landlord_subscriptions')
        .update({ landlord_id: primaryUser.id })
        .eq('landlord_id', duplicateUser.id);

      // 2. Merge roles (ensure primary user gets all roles)
      const duplicateRoles = duplicateUser.user_roles || [];
      const primaryRoles = primaryUser.user_roles || [];
      
      for (const roleData of duplicateRoles) {
        const hasRole = primaryRoles.some(r => r.role === roleData.role);
        if (!hasRole && ['Admin', 'Landlord', 'Manager', 'Agent', 'Tenant', 'System'].includes(roleData.role)) {
          await supabase
            .from('user_roles')
            .upsert({ 
              user_id: primaryUser.id, 
              role: roleData.role as "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant" | "System"
            }, {
              onConflict: 'user_id,role'
            });
        }
      }

      // 3. Update profile with best available data
      const mergedProfile = {
        first_name: primaryUser.first_name || duplicateUser.first_name,
        last_name: primaryUser.last_name || duplicateUser.last_name,
        phone: primaryUser.phone || duplicateUser.phone,
      };

      await supabase
        .from('profiles')
        .update(mergedProfile)
        .eq('id', primaryUser.id);

      // 4. Log the merge action
      await supabase
        .from('role_change_logs')
        .insert({
          user_id: primaryUser.id,
          old_role: null,
          new_role: 'Admin', // Placeholder - will be handled by trigger
          changed_by: primaryUser.id,
          reason: 'Account merge operation',
          metadata: {
            operation: 'ACCOUNT_MERGE',
            merged_from_user: duplicateUser.id,
            merged_from_email: duplicateUser.email,
            timestamp: new Date().toISOString()
          }
        });

      // 5. Delete the duplicate user's roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', duplicateUser.id);

      // 6. Delete the duplicate profile
      await supabase
        .from('profiles')
        .delete()
        .eq('id', duplicateUser.id);

      toast({
        title: "Accounts Merged Successfully",
        description: `${duplicateUser.first_name} ${duplicateUser.last_name}'s account has been merged into ${primaryUser.first_name} ${primaryUser.last_name}'s account.`,
      });

      onMergeComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error merging accounts:', error);
      toast({
        title: "Merge Failed",
        description: error instanceof Error ? error.message : "Failed to merge accounts",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  const getUserRole = (user: UserProfile) => {
    return user.user_roles?.[0]?.role || "No Role";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-tint-gray">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Duplicate Accounts
          </DialogTitle>
        </DialogHeader>

        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This action will merge all data from the duplicate account into the primary account and cannot be undone.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Primary User */}
          <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Primary Account (Keep)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="font-medium">{primaryUser.first_name} {primaryUser.last_name}</p>
                <p className="text-sm text-muted-foreground">{primaryUser.email}</p>
                <p className="text-sm text-muted-foreground">{primaryUser.phone}</p>
                <Badge variant="secondary" className="mt-1">{getUserRole(primaryUser)}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Duplicate User */}
          <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Duplicate Account (Remove)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="font-medium">{duplicateUser.first_name} {duplicateUser.last_name}</p>
                <p className="text-sm text-muted-foreground">{duplicateUser.email}</p>
                <p className="text-sm text-muted-foreground">{duplicateUser.phone}</p>
                <Badge variant="secondary" className="mt-1">{getUserRole(duplicateUser)}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2 mb-4">
          <h4 className="font-medium">Merge Process:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Transfer all properties, tenants, and data to primary account</li>
            <li>• Combine roles from both accounts</li>
            <li>• Update profile with best available information</li>
            <li>• Remove duplicate account permanently</li>
            <li>• Log merge action for audit trail</li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={merging}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleMergeAccounts}
            disabled={merging}
            className="bg-red-600 hover:bg-red-700"
          >
            {merging ? "Merging..." : "Merge Accounts"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}