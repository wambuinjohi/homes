import React, { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Zap, AlertTriangle } from "lucide-react";
import { useTrialManagement } from "@/hooks/useTrialManagement";

interface FeatureGateProps {
  children: ReactNode;
  featureName: string;
  requiredPlan?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  allowReadOnly?: boolean;
}

export function FeatureGate({ 
  children, 
  featureName, 
  requiredPlan = "Pro",
  fallbackTitle,
  fallbackDescription,
  allowReadOnly = false
}: FeatureGateProps) {
  const { trialStatus, loading } = useTrialManagement();

  if (loading) {
    return (
      <Card className="opacity-50">
        <CardContent className="p-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const handleUpgrade = () => {
    window.location.href = '/landlord/billing';
  };

  // Allow access for active trials
  if (trialStatus?.isActive) {
    return <>{children}</>;
  }

  // Allow read-only access during grace period if specified
  if (allowReadOnly && trialStatus?.isExpired && trialStatus?.hasGracePeriod) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-75">
          {children}
        </div>
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Card className="border-warning">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-2" />
              <p className="text-sm font-medium mb-2">Read-Only Mode</p>
              <p className="text-xs text-muted-foreground mb-3">
                Your trial has expired. You can view data but cannot make changes.
              </p>
              <Button onClick={handleUpgrade} size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Upgrade to Edit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Block access for expired/suspended accounts
  return (
    <Card className="border-muted-foreground/20">
      <CardHeader className="text-center">
        <div className="mx-auto p-3 bg-muted rounded-full mb-3">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">
          {fallbackTitle || `${featureName} - Premium Feature`}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">
          {fallbackDescription || 
            `Access to ${featureName.toLowerCase()} requires an active subscription.`}
        </p>
        
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline">
            Requires {requiredPlan} Plan
          </Badge>
        </div>

        {trialStatus?.isSuspended ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Your account is suspended. Upgrade to restore access.
            </p>
            <Button onClick={handleUpgrade} className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Restore Access
            </Button>
          </div>
        ) : (
          <Button onClick={handleUpgrade} className="w-full">
            <Zap className="h-4 w-4 mr-2" />
            Upgrade to Access
          </Button>
        )}
      </CardContent>
    </Card>
  );
}