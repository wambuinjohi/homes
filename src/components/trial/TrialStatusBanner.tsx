import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Clock, Ban, Zap, Download } from "lucide-react";
import { useTrialManagement } from "@/hooks/useTrialManagement";

export function TrialStatusBanner() {
  const { trialStatus, loading } = useTrialManagement();

  if (loading || !trialStatus) return null;

  const handleUpgrade = () => {
    window.location.href = '/landlord/billing';
  };

  const handleExportData = () => {
    // TODO: Implement data export functionality
    console.log('Export data functionality to be implemented');
  };

  // Trial expired - Grace period
  if (trialStatus.isExpired && trialStatus.hasGracePeriod) {
    return (
      <Alert className="mb-6 border-destructive/50 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong>Trial Expired!</strong> You have {trialStatus.gracePeriodDays} days of limited access remaining to export your data and upgrade.
          </div>
          <div className="flex gap-2 ml-4">
            <Button onClick={handleExportData} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button onClick={handleUpgrade} size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Account suspended
  if (trialStatus.isSuspended) {
    return (
      <Alert className="mb-6 border-destructive text-destructive">
        <Ban className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong>Account Suspended!</strong> Your trial and grace period have ended. Upgrade now to restore access to your account.
          </div>
          <Button onClick={handleUpgrade} size="sm" className="ml-4">
            <Zap className="h-4 w-4 mr-2" />
            Upgrade to Restore Access
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Active trial with warnings
  if (trialStatus.isActive && trialStatus.daysRemaining <= 7) {
    const isUrgent = trialStatus.daysRemaining <= 3;
    
    return (
      <Card className={`mb-6 border-2 ${isUrgent ? 'border-destructive/50' : 'border-warning/50'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isUrgent ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                <Clock className={`h-5 w-5 ${isUrgent ? 'text-destructive' : 'text-warning'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-semibold ${isUrgent ? 'text-destructive' : 'text-warning'}`}>
                    {isUrgent ? 'Trial Ending Soon!' : 'Trial Reminder'}
                  </h3>
                  <Badge variant={isUrgent ? "destructive" : "secondary"}>
                    {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''} left
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isUrgent 
                    ? 'Your trial expires very soon. Upgrade now to avoid losing access to your data.'
                    : 'Your trial will expire soon. Upgrade to continue using all features.'}
                </p>
              </div>
            </div>
            <Button onClick={handleUpgrade} variant={isUrgent ? "destructive" : "default"}>
              <Zap className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}