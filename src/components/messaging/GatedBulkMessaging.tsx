import React from "react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface GatedBulkMessagingProps {
  children: React.ReactNode;
}

export function GatedBulkMessaging({ children }: GatedBulkMessagingProps) {
  return (
    <FeatureGate
      feature={FEATURES.SMS_NOTIFICATIONS}
      fallbackTitle="Bulk SMS Messaging"
      fallbackDescription="Send SMS notifications to multiple tenants at once. Stay connected with your tenants through automated and manual SMS communications."
      allowReadOnly={false}
    >
      {children}
    </FeatureGate>
  );
}

// Fallback component for when SMS is not available
export function SMSNotAvailable() {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle>SMS Messaging Not Available</CardTitle>
        <CardDescription>
          Upgrade your plan to send SMS notifications to your tenants
        </CardDescription>
      </CardHeader>
    </Card>
  );
}