import React from "react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface GatedAPIAccessProps {
  children: React.ReactNode;
}

export function GatedAPIAccess({ children }: GatedAPIAccessProps) {
  return (
    <FeatureGate
      feature={FEATURES.API_ACCESS}
      fallbackTitle="API Integration Access"
      fallbackDescription="Connect with third-party applications, automate workflows, and integrate with accounting systems through our powerful API."
      allowReadOnly={false}
    >
      {children}
    </FeatureGate>
  );
}