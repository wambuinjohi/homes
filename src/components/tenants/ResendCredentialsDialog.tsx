import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ResendCredentialsDialogProps {
  tenant: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  children: React.ReactNode;
}

export function ResendCredentialsDialog({ tenant, children }: ResendCredentialsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [includeEmail, setIncludeEmail] = useState(true);
  const [includeSMS, setIncludeSMS] = useState(true);
  const { toast } = useToast();

  // Check SMS provider status using edge function (works for all roles)
  const { data: smsStatus, isLoading: smsStatusLoading } = useQuery({
    queryKey: ['sms-provider-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-sms-provider');
      
      if (error || !data?.success) {
        console.log('SMS provider not available:', error);
        return {
          available: false,
          providerName: 'Not Configured'
        };
      }
      
      return {
        available: true,
        providerName: data.provider?.provider_name || 'Unknown'
      };
    },
    staleTime: 60000, // Cache for 1 minute
  });

  const resendCredentials = async () => {
    if (!includeEmail && !includeSMS) {
      toast({
        title: "Select Notification Method",
        description: "Please select at least one notification method (Email or SMS)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const loginUrl = `${window.location.origin}/auth`;
      
      const { data, error } = await supabase.functions.invoke('send-tenant-welcome-notifications', {
        body: {
          tenantId: tenant.id,
          includeEmail,
          includeSMS,
          loginUrl
        }
      });

      if (error) throw error;

      // Check if password was actually updated
      if (!data?.passwordUpdated) {
        toast({
          title: "Password Update Failed",
          description: data?.passwordError || "Could not update the tenant's password in the authentication system. No notifications were sent.",
          variant: "destructive",
        });
        return;
      }

      // Parse results
      const emailSuccess = data?.results?.email?.success;
      const smsSuccess = data?.results?.sms?.success;
      
      const successMessages: string[] = [];
      const failureMessages: string[] = [];

      if (includeEmail) {
        if (emailSuccess) {
          successMessages.push(`✅ Email sent to ${tenant.email}`);
        } else {
          failureMessages.push(`❌ Email failed: ${data?.results?.email?.error || 'Unknown error'}`);
        }
      }

      if (includeSMS) {
        if (smsSuccess) {
          successMessages.push(`✅ SMS sent to ${tenant.phone}`);
        } else {
          failureMessages.push(`❌ SMS failed: ${data?.results?.sms?.error || 'Unknown error'}`);
        }
      }

      if (successMessages.length > 0) {
        toast({
          title: "Credentials Sent",
          description: (
            <div className="space-y-1">
              <p className="font-medium">New login credentials have been generated and sent:</p>
              {successMessages.map((msg, i) => (
                <p key={i} className="text-sm">{msg}</p>
              ))}
              {failureMessages.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground mt-2">Partial failures:</p>
                  {failureMessages.map((msg, i) => (
                    <p key={i} className="text-sm text-muted-foreground">{msg}</p>
                  ))}
                </>
              )}
            </div>
          ),
        });
        setOpen(false);
      } else {
        throw new Error(failureMessages.join(", ") || "All delivery methods failed");
      }
    } catch (error: any) {
      console.error("Error resending credentials:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const smsAvailable = smsStatus?.available && !smsStatusLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle className="text-primary">Resend Login Credentials</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* SMS Provider Status Indicator */}
          <div className="flex items-center gap-2">
            {smsStatusLoading ? (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Checking SMS status...
              </Badge>
            ) : smsAvailable ? (
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                SMS Available ({smsStatus.providerName})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                <XCircle className="h-3 w-3 mr-1" />
                SMS Unavailable - Email only
              </Badge>
            )}
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium text-primary mb-2">Tenant Details</h4>
            <p className="text-sm text-muted-foreground">
              <strong>Name:</strong> {tenant.first_name} {tenant.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Email:</strong> {tenant.email}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Phone:</strong> {tenant.phone || 'Not provided'}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-primary">Notification Methods</h4>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-email"
                checked={includeEmail}
                onCheckedChange={(checked) => setIncludeEmail(checked as boolean)}
              />
              <Label
                htmlFor="include-email"
                className="text-sm font-normal cursor-pointer"
              >
                Send via Email to {tenant.email}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-sms"
                checked={includeSMS}
                onCheckedChange={(checked) => setIncludeSMS(checked as boolean)}
                disabled={!tenant.phone || !smsAvailable}
              />
              <Label
                htmlFor="include-sms"
                className={`text-sm font-normal ${(!tenant.phone || !smsAvailable) ? 'opacity-50' : 'cursor-pointer'}`}
              >
                Send via SMS to {tenant.phone || 'No phone number'}
              </Label>
            </div>

            <Button
              onClick={resendCredentials}
              disabled={loading}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {loading ? "Sending..." : "Send New Credentials"}
            </Button>
          </div>

          {!tenant.phone && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No phone number available for this tenant. SMS cannot be sent.
              </AlertDescription>
            </Alert>
          )}
          
          {!smsAvailable && tenant.phone && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                SMS provider not configured. Please contact your administrator or use email.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
            <p className="text-xs text-destructive">
              <strong>Note:</strong> This will generate a new temporary password and update it in the system. The tenant's old password will no longer work.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}